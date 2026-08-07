const { Program } = require('../../services/program-service');
const { PROGRAM } = require('../../crdc-datahub-database-drivers/constants/organization-constants');
const {ERROR : SUBMODULE_ERROR}  = require('../../crdc-datahub-database-drivers/constants/error-constants');
const ERROR = require('../../constants/error-constants');
const {replaceErrorString} = require('../../utility/string-util');

jest.mock('../../utility/data-commons-remapper', () => ({
  getDataCommonsDisplayNamesForUserOrganization: jest.fn((org) => org)
}));

// Mock DAO classes
jest.mock('../../dao/program');
jest.mock('../../dao/user');
jest.mock('../../dao/submission');
jest.mock('../../dao/submission-request');
jest.mock('../../dao/approvedStudy');

const ProgramDAO = require('../../dao/program');
const UserDAO = require('../../dao/user');
const SubmissionDAO = require('../../dao/submission');
const SubmissionRequestDAO = require('../../dao/submission-request');
const ApprovedStudyDAO = require('../../dao/approvedStudy');


describe('Program.listPrograms', () => {
  let program;
  let mockProgramDAO;
  let mockUserDAO;
  let mockSubmissionDAO;
  let mockSubmissionRequestDAO;
  let mockApprovedStudyDAO;

  beforeEach(() => {
    mockProgramDAO = { listPrograms: jest.fn() };
    mockUserDAO = {};
    mockSubmissionDAO = {};
    mockSubmissionRequestDAO = {};
    mockApprovedStudyDAO = {};
    ProgramDAO.mockImplementation(() => mockProgramDAO);
    UserDAO.mockImplementation(() => mockUserDAO);
    SubmissionDAO.mockImplementation(() => mockSubmissionDAO);
    SubmissionRequestDAO.mockImplementation(() => mockSubmissionRequestDAO);
    ApprovedStudyDAO.mockImplementation(() => mockApprovedStudyDAO);
    program = new Program({}, {});
    jest.clearAllMocks();
  });

  const context = { userInfo: { email: 'test@email.com', IDP: 'test-idp' } };

  it('should return programs and total count for valid status', async () => {
    const params = {
      first: 10,
      offset: 0,
      orderBy: 'name',
      sortDirection: 'asc',
      status: PROGRAM.STATUSES.ACTIVE
    };
    const mockPrograms = [{ _id: 'org1', name: 'Program 1' }];
    mockProgramDAO.listPrograms.mockResolvedValue({ total: 1, results: mockPrograms });

    const result = await program.listPrograms(params, context);
    expect(result.total).toBe(1);
    expect(result.programs).toEqual(mockPrograms);
    expect(mockProgramDAO.listPrograms).toHaveBeenCalledWith(
      10,
      0,
      'name',
      'asc',
      { status: PROGRAM.STATUSES.ACTIVE }
    );
  });

  it('should throw for invalid status input', async () => {
    const params = {
      first: 10,
      offset: 0,
      orderBy: 'name',
      sortDirection: 'asc',
      status: 'INVALID_STATUS'
    };
    await expect(program.listPrograms(params, context)).rejects.toThrow(
      replaceErrorString(SUBMODULE_ERROR.INVALID_PROGRAM_STATUS, params.status)
    );
    expect(mockProgramDAO.listPrograms).not.toHaveBeenCalled();
  });

  it('should support case-insensitive status input', async () => {
    const params = {
      first: 10,
      offset: 0,
      orderBy: 'name',
      sortDirection: 'asc',
      status: 'aCtIvE'
    };
    mockProgramDAO.listPrograms.mockResolvedValue({ total: 0, results: [] });
    await program.listPrograms(params, context);
    expect(mockProgramDAO.listPrograms).toHaveBeenCalledWith(
      10,
      0,
      'name',
      'asc',
      { status: PROGRAM.STATUSES.ACTIVE }
    );
  });

  it('should treat case-insensitive All as all statuses', async () => {
    const params = {
      first: 10,
      offset: 0,
      orderBy: 'name',
      sortDirection: 'asc',
      status: 'aLl'
    };
    mockProgramDAO.listPrograms.mockResolvedValue({ total: 0, results: [] });
    await program.listPrograms(params, context);
    expect(mockProgramDAO.listPrograms).toHaveBeenCalledWith(
      10,
      0,
      'name',
      'asc',
      { status: { $in: [PROGRAM.STATUSES.ACTIVE, PROGRAM.STATUSES.INACTIVE] } }
    );
  });

  it('should default status to All when omitted', async () => {
    const params = {
      first: 10,
      offset: 0,
      orderBy: 'name',
      sortDirection: 'asc'
    };
    mockProgramDAO.listPrograms.mockResolvedValue({ total: 0, results: [] });
    await program.listPrograms(params, context);
    expect(mockProgramDAO.listPrograms).toHaveBeenCalledWith(
      10,
      0,
      'name',
      'asc',
      { status: { $in: [PROGRAM.STATUSES.ACTIVE, PROGRAM.STATUSES.INACTIVE] } }
    );
  });

  it('should throw error if not logged in', async () => {
    const params = {
      first: 10,
      offset: 0,
      orderBy: 'name',
      sortDirection: 'asc',
      status: PROGRAM.STATUSES.ACTIVE
    };
    const badContext = { userInfo: {} };
    await expect(program.listPrograms(params, badContext)).rejects.toThrow(ERROR.NOT_LOGGED_IN);
  });
});

describe('Program.createProgram', () => {
  let program;
  let mockProgramDAO;
  let mockUserDAO;
  let mockSubmissionDAO;
  let mockSubmissionRequestDAO;
  let mockApprovedStudyDAO;

  beforeEach(() => {
    mockProgramDAO = { getProgramByName: jest.fn(), getProgramByID: jest.fn(), create: jest.fn() };
    mockUserDAO = { findFirst: jest.fn() };
    mockSubmissionDAO = {};
    mockSubmissionRequestDAO = {};
    mockApprovedStudyDAO = { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), count: jest.fn() };
    ProgramDAO.mockImplementation(() => mockProgramDAO);
    UserDAO.mockImplementation(() => mockUserDAO);
    SubmissionDAO.mockImplementation(() => mockSubmissionDAO);
    SubmissionRequestDAO.mockImplementation(() => mockSubmissionRequestDAO);
    ApprovedStudyDAO.mockImplementation(() => mockApprovedStudyDAO);
    program = new Program({}, {});
    jest.clearAllMocks();
    program._checkRemovedStudies = jest.fn();
  });

  it('should create a new organization successfully', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
    };
    mockProgramDAO.getProgramByName.mockResolvedValue(null);
    mockProgramDAO.create.mockResolvedValue({ _id: 'orgid', name: 'Test Org', abbreviation: 'TST', description: 'desc' });
    const result = await program.createProgram(params);
    expect(result).toEqual({ _id: 'orgid', name: 'Test Org', abbreviation: 'TST', description: 'desc' });
    expect(mockProgramDAO.create).toHaveBeenCalled();
  });

  it('should throw error if organization name already exists', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
    };
    mockProgramDAO.getProgramByName.mockResolvedValue({ _id: 'existing' });
    await expect(program.createProgram(params)).rejects.toThrow('An organization with the same name already exists');
  });

  it('should throw error if organization name is invalid', async () => {
    const params = {
      name: '',
      abbreviation: 'TST',
      description: 'desc',
    };
    await expect(program.createProgram(params)).rejects.toThrow('The organization name you provided is invalid');
  });

  it('should throw error if abbreviation is missing', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: '',
      description: 'desc',
    };
    mockProgramDAO.getProgramByName.mockResolvedValue(null);
    mockProgramDAO.create.mockResolvedValue(undefined);
    await expect(program.createProgram(params)).rejects.toThrow('Unknown error occurred while creating object');
  });

  it('should throw error if conciergeID is invalid', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
      conciergeID: 'user123'
    };
    mockProgramDAO.getProgramByName.mockResolvedValue(null);
    mockUserDAO.findFirst.mockResolvedValue(null);
    await expect(program.createProgram(params)).rejects.toThrow('The role you are trying to assign is invalid');
  });

  it('should create organization with concierge info', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
      conciergeID: 'user123'
    };
    mockProgramDAO.getProgramByName.mockResolvedValue(null);
    mockUserDAO.findFirst.mockResolvedValue({ _id: 'user123', firstName: 'Jane', lastName: 'Doe', email: 'jane@doe.com' });
    mockProgramDAO.create.mockResolvedValue({ _id: 'orgid', name: 'Test Org', abbreviation: 'TST', description: 'desc', conciergeID: 'user123', conciergeName: 'Jane Doe', conciergeEmail: 'jane@doe.com' });
    const result = await program.createProgram(params);
    expect(result).toEqual({ _id: 'orgid', name: 'Test Org', abbreviation: 'TST', description: 'desc', conciergeID: 'user123', conciergeName: 'Jane Doe', conciergeEmail: 'jane@doe.com' });
    expect(mockUserDAO.findFirst).toHaveBeenCalled();
    expect(mockProgramDAO.create).toHaveBeenCalled();
  });
});

describe('Program.getProgramAPI', () => {
  let program;
  let mockProgramDAO;
  let mockUserDAO;
  let mockSubmissionDAO;
  let mockSubmissionRequestDAO;
  let mockApprovedStudyDAO;

  beforeEach(() => {
    mockProgramDAO = { getProgramByID: jest.fn() };
    mockUserDAO = {};
    mockSubmissionDAO = {};
    mockSubmissionRequestDAO = {};
    mockApprovedStudyDAO = {};
    ProgramDAO.mockImplementation(() => mockProgramDAO);
    UserDAO.mockImplementation(() => mockUserDAO);
    SubmissionDAO.mockImplementation(() => mockSubmissionDAO);
    SubmissionRequestDAO.mockImplementation(() => mockSubmissionRequestDAO);
    ApprovedStudyDAO.mockImplementation(() => mockApprovedStudyDAO);
    program = new Program({}, {});
    jest.clearAllMocks();
  });

  const context = { userInfo: { email: 'test@email.com', IDP: 'test-idp' } };

  it('should return the organization for a valid orgID', async () => {
    const params = { orgID: 'org123' };
    const mockOrg = { _id: 'org123', name: 'Test Org' };
    mockProgramDAO.getProgramByID.mockResolvedValue(mockOrg);
    const result = await program.getProgramAPI(params, context);
    expect(result).toEqual(mockOrg);
    expect(mockProgramDAO.getProgramByID).toHaveBeenCalledWith('org123', true);
  });

  it('should request studies from DAO and preserve them in the response', async () => {
    const params = { orgID: 'org123' };
    const mockOrg = {
      _id: 'org123',
      name: 'Test Org',
      studies: [{ _id: 's1', id: 's1', studyAbbreviation: 'TST', studyName: 'Trial' }],
    };
    mockProgramDAO.getProgramByID.mockResolvedValue(mockOrg);
    const result = await program.getProgramAPI(params, context);
    expect(mockProgramDAO.getProgramByID).toHaveBeenCalledWith('org123', true);
    expect(result.studies).toEqual(mockOrg.studies);
  });

  it('should throw error if orgID is missing', async () => {
    await expect(program.getProgramAPI({}, context)).rejects.toThrow(ERROR.INVALID_ORG_ID);
  });

  it('should throw error if not logged in', async () => {
    const params = { orgID: 'org123' };
    const badContext = { userInfo: {} };
    await expect(program.getProgramAPI(params, badContext)).rejects.toThrow(ERROR.NOT_LOGGED_IN);
  });
});

describe('Program.getProgramByID', () => {
  let program;
  let mockProgramDAO;

  beforeEach(() => {
    mockProgramDAO = { getProgramByID: jest.fn() };
    ProgramDAO.mockImplementation(() => mockProgramDAO);
    program = new Program({}, {});
    jest.clearAllMocks();
  });

  it('should throw when includeStudiesList is omitted', async () => {
    await expect(program.getProgramByID('org123')).rejects.toThrow(
      SUBMODULE_ERROR.INVALID_INCLUDE_STUDIES_LIST_ARGUMENT
    );
    expect(mockProgramDAO.getProgramByID).not.toHaveBeenCalled();
  });
});

describe('Program.editProgram', () => {
  let program;
  let mockProgramDAO;
  let mockUserDAO;
  let mockSubmissionDAO;
  let mockSubmissionRequestDAO;
  let mockApprovedStudyDAO;

  beforeEach(() => {
    mockProgramDAO = { 
      getProgramByID: jest.fn(), 
      getProgramByName: jest.fn(),
      updateMany: jest.fn() 
    };
    mockUserDAO = { findFirst: jest.fn(), updateUserOrg: jest.fn() };
    mockSubmissionDAO = {};
    mockSubmissionRequestDAO = { updateSubmissionRequestOrg: jest.fn() };
    mockApprovedStudyDAO = { findMany: jest.fn(), updateMany: jest.fn(), count: jest.fn() };
    
    ProgramDAO.mockImplementation(() => mockProgramDAO);
    UserDAO.mockImplementation(() => mockUserDAO);
    SubmissionDAO.mockImplementation(() => mockSubmissionDAO);
    SubmissionRequestDAO.mockImplementation(() => mockSubmissionRequestDAO);
    ApprovedStudyDAO.mockImplementation(() => mockApprovedStudyDAO);
    
    program = new Program({}, {});
    jest.clearAllMocks();
  });

  it('should edit organization name successfully', async () => {
    const orgID = 'org-123';
    const params = { name: 'Updated Org' };
    const currentOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST', status: PROGRAM.STATUSES.ACTIVE };

    mockProgramDAO.getProgramByID.mockResolvedValue(currentOrg);
    mockProgramDAO.getProgramByName.mockResolvedValue(null);
    mockProgramDAO.updateMany.mockResolvedValue({ count: 1 });
    mockUserDAO.updateUserOrg.mockResolvedValue({ count: 1 });
    mockSubmissionRequestDAO.updateSubmissionRequestOrg.mockResolvedValue({ acknowledged: true });

    const result = await program.editProgram(orgID, params);

    expect(result).toEqual({ ...currentOrg, name: 'Updated Org', updateAt: expect.any(Date) });
    expect(mockProgramDAO.updateMany).toHaveBeenCalled();
    expect(mockUserDAO.updateUserOrg).toHaveBeenCalledWith(orgID, expect.objectContaining({ name: 'Updated Org' }));
    expect(mockApprovedStudyDAO.findMany).not.toHaveBeenCalled();
    expect(mockApprovedStudyDAO.updateMany).not.toHaveBeenCalled();
  });

  it(`should throw when setting status ${PROGRAM.STATUSES.INACTIVE} while program has assigned studies`, async () => {
    const orgID = 'org-123';
    const currentOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST' };
    mockProgramDAO.getProgramByID.mockResolvedValue(currentOrg);
    mockApprovedStudyDAO.count.mockResolvedValue(2);

    await expect(program.editProgram(orgID, { status: PROGRAM.STATUSES.INACTIVE })).rejects.toThrow(
      SUBMODULE_ERROR.PROGRAM_CANNOT_INACTIVATE_WITH_STUDIES
    );
    expect(mockProgramDAO.updateMany).not.toHaveBeenCalled();
  });

  it('should omit duplicate-name lookup when only status is updated (no name in params)', async () => {
    const orgID = 'org-123';
    const currentOrg = {
      _id: orgID,
      name: 'Test Org',
      abbreviation: 'TST',
      status: PROGRAM.STATUSES.ACTIVE
    };
    mockProgramDAO.getProgramByID.mockResolvedValue(currentOrg);
    mockApprovedStudyDAO.count.mockResolvedValue(0);
    mockProgramDAO.updateMany.mockResolvedValue({ count: 1 });
    mockProgramDAO.getProgramByName.mockResolvedValue({ _id: 'other-id', name: 'collision' });

    const result = await program.editProgram(orgID, { status: PROGRAM.STATUSES.INACTIVE });

    expect(mockProgramDAO.getProgramByName).not.toHaveBeenCalled();
    expect(mockProgramDAO.updateMany).toHaveBeenCalledWith(
      { _id: orgID },
      expect.objectContaining({ status: PROGRAM.STATUSES.INACTIVE, updateAt: expect.any(Date) })
    );
    expect(result.status).toBe(PROGRAM.STATUSES.INACTIVE);
  });

  it('should set status Active when explicitly requested', async () => {
    const orgID = 'org-123';
    const currentOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST', status: PROGRAM.STATUSES.INACTIVE };
    mockProgramDAO.getProgramByID.mockResolvedValue(currentOrg);
    mockProgramDAO.updateMany.mockResolvedValue({ count: 1 });

    const result = await program.editProgram(orgID, { status: PROGRAM.STATUSES.ACTIVE });

    expect(result.status).toBe(PROGRAM.STATUSES.ACTIVE);
    expect(mockProgramDAO.updateMany).toHaveBeenCalledWith(
      { _id: orgID },
      expect.objectContaining({ status: PROGRAM.STATUSES.ACTIVE, updateAt: expect.any(Date) })
    );
  });

  it('should reject inactivating a read-only program (e.g. system catch-all)', async () => {
    const orgID = 'readonly-org-id';
    const currentOrg = {
      _id: orgID,
      name: 'NA',
      abbreviation: 'NA',
      readOnly: true,
      status: PROGRAM.STATUSES.ACTIVE
    };
    mockProgramDAO.getProgramByID.mockResolvedValue(currentOrg);

    await expect(program.editProgram(orgID, { status: PROGRAM.STATUSES.INACTIVE })).rejects.toThrow(
      SUBMODULE_ERROR.CANNOT_UPDATE_READ_ONLY_PROGRAM
    );
    expect(mockProgramDAO.updateMany).not.toHaveBeenCalled();
  });
});
