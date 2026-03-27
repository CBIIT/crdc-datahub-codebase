const { Organization } = require('../../crdc-datahub-database-drivers/services/organization');
const { ORGANIZATION } = require('../../crdc-datahub-database-drivers/constants/organization-constants');
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
jest.mock('../../dao/application');
jest.mock('../../dao/approvedStudy');

const ProgramDAO = require('../../dao/program');
const UserDAO = require('../../dao/user');
const SubmissionDAO = require('../../dao/submission');
const ApplicationDAO = require('../../dao/application');
const ApprovedStudyDAO = require('../../dao/approvedStudy');


describe('Organization.listPrograms', () => {
  let organization;
  let mockProgramDAO;
  let mockUserDAO;
  let mockSubmissionDAO;
  let mockApplicationDAO;
  let mockApprovedStudyDAO;

  beforeEach(() => {
    mockProgramDAO = { listPrograms: jest.fn() };
    mockUserDAO = {};
    mockSubmissionDAO = {};
    mockApplicationDAO = {};
    mockApprovedStudyDAO = {};
    ProgramDAO.mockImplementation(() => mockProgramDAO);
    UserDAO.mockImplementation(() => mockUserDAO);
    SubmissionDAO.mockImplementation(() => mockSubmissionDAO);
    ApplicationDAO.mockImplementation(() => mockApplicationDAO);
    ApprovedStudyDAO.mockImplementation(() => mockApprovedStudyDAO);
    organization = new Organization(
      {}, {}, {}, {}, {}
    );
    jest.clearAllMocks();
  });

  const context = { userInfo: { email: 'test@email.com', IDP: 'test-idp' } };

  it('should return programs and total count for valid status', async () => {
    const params = {
      first: 10,
      offset: 0,
      orderBy: 'name',
      sortDirection: 'asc',
      status: ORGANIZATION.STATUSES.ACTIVE
    };
    const mockPrograms = [{ _id: 'org1', name: 'Program 1' }];
    mockProgramDAO.listPrograms.mockResolvedValue({ total: 1, results: mockPrograms });

    const result = await organization.listPrograms(params, context);
    expect(result.total).toBe(1);
    expect(result.programs).toEqual(mockPrograms);
    expect(mockProgramDAO.listPrograms).toHaveBeenCalledWith(
      10,
      0,
      'name',
      'asc',
      { status: ORGANIZATION.STATUSES.ACTIVE }
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
    await expect(organization.listPrograms(params, context)).rejects.toThrow(
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
    await organization.listPrograms(params, context);
    expect(mockProgramDAO.listPrograms).toHaveBeenCalledWith(
      10,
      0,
      'name',
      'asc',
      { status: ORGANIZATION.STATUSES.ACTIVE }
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
    await organization.listPrograms(params, context);
    expect(mockProgramDAO.listPrograms).toHaveBeenCalledWith(
      10,
      0,
      'name',
      'asc',
      { status: { $in: [ORGANIZATION.STATUSES.ACTIVE, ORGANIZATION.STATUSES.INACTIVE] } }
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
    await organization.listPrograms(params, context);
    expect(mockProgramDAO.listPrograms).toHaveBeenCalledWith(
      10,
      0,
      'name',
      'asc',
      { status: { $in: [ORGANIZATION.STATUSES.ACTIVE, ORGANIZATION.STATUSES.INACTIVE] } }
    );
  });

  it('should throw error if not logged in', async () => {
    const params = {
      first: 10,
      offset: 0,
      orderBy: 'name',
      sortDirection: 'asc',
      status: ORGANIZATION.STATUSES.ACTIVE
    };
    const badContext = { userInfo: {} };
    await expect(organization.listPrograms(params, badContext)).rejects.toThrow(ERROR.NOT_LOGGED_IN);
  });
});

describe('Organization.createOrganization', () => {
  let organization;
  let mockProgramDAO;
  let mockUserDAO;
  let mockSubmissionDAO;
  let mockApplicationDAO;
  let mockApprovedStudyDAO;

  beforeEach(() => {
    mockProgramDAO = { getOrganizationByName: jest.fn(), getOrganizationByID: jest.fn(), create: jest.fn() };
    mockUserDAO = { findFirst: jest.fn() };
    mockSubmissionDAO = {};
    mockApplicationDAO = {};
    mockApprovedStudyDAO = { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), count: jest.fn() };
    ProgramDAO.mockImplementation(() => mockProgramDAO);
    UserDAO.mockImplementation(() => mockUserDAO);
    SubmissionDAO.mockImplementation(() => mockSubmissionDAO);
    ApplicationDAO.mockImplementation(() => mockApplicationDAO);
    ApprovedStudyDAO.mockImplementation(() => mockApprovedStudyDAO);
    organization = new Organization(
      {}, {}, {}, {}, {}
    );
    jest.clearAllMocks();
    organization._checkRemovedStudies = jest.fn();
  });

  it('should create a new organization successfully', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
    };
    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockProgramDAO.create.mockResolvedValue({ _id: 'orgid', name: 'Test Org', abbreviation: 'TST', description: 'desc' });
    const result = await organization.createOrganization(params);
    expect(result).toEqual({ _id: 'orgid', name: 'Test Org', abbreviation: 'TST', description: 'desc' });
    expect(mockProgramDAO.create).toHaveBeenCalled();
  });

  it('should throw error if organization name already exists', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
    };
    mockProgramDAO.getOrganizationByName.mockResolvedValue({ _id: 'existing' });
    await expect(organization.createOrganization(params)).rejects.toThrow('An organization with the same name already exists');
  });

  it('should throw error if organization name is invalid', async () => {
    const params = {
      name: '',
      abbreviation: 'TST',
      description: 'desc',
    };
    await expect(organization.createOrganization(params)).rejects.toThrow('The organization name you provided is invalid');
  });

  it('should throw error if abbreviation is missing', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: '',
      description: 'desc',
    };
    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockProgramDAO.create.mockResolvedValue(undefined);
    await expect(organization.createOrganization(params)).rejects.toThrow('Unknown error occurred while creating object');
  });

  it('should throw error if conciergeID is invalid', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
      conciergeID: 'user123'
    };
    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockUserDAO.findFirst.mockResolvedValue(null);
    await expect(organization.createOrganization(params)).rejects.toThrow('The role you are trying to assign is invalid');
  });

  it('should create organization with concierge info', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
      conciergeID: 'user123'
    };
    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockUserDAO.findFirst.mockResolvedValue({ _id: 'user123', firstName: 'Jane', lastName: 'Doe', email: 'jane@doe.com' });
    mockProgramDAO.create.mockResolvedValue({ _id: 'orgid', name: 'Test Org', abbreviation: 'TST', description: 'desc', conciergeID: 'user123', conciergeName: 'Jane Doe', conciergeEmail: 'jane@doe.com' });
    const result = await organization.createOrganization(params);
    expect(result).toEqual({ _id: 'orgid', name: 'Test Org', abbreviation: 'TST', description: 'desc', conciergeID: 'user123', conciergeName: 'Jane Doe', conciergeEmail: 'jane@doe.com' });
    expect(mockUserDAO.findFirst).toHaveBeenCalled();
    expect(mockProgramDAO.create).toHaveBeenCalled();
  });

  it('should create organization with studies and update their programID', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
      studies: [
        { studyID: 'study-1' },
        { studyID: 'study-2' }
      ]
    };
    const createdOrg = {
      _id: 'org-123',
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
      status: ORGANIZATION.STATUSES.ACTIVE,
    };
    const existingStudies = [
      { id: 'study-1' },
      { id: 'study-2' }
    ];

    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockProgramDAO.create.mockResolvedValue(createdOrg);
    mockProgramDAO.getOrganizationByID.mockResolvedValue(createdOrg);
    mockApprovedStudyDAO.findMany.mockResolvedValue(existingStudies);
    mockApprovedStudyDAO.updateMany.mockResolvedValue({ count: 2 });

    const result = await organization.createOrganization(params);
    
    expect(result).toEqual(createdOrg);
    expect(mockProgramDAO.create).toHaveBeenCalled();
    expect(mockApprovedStudyDAO.findMany).toHaveBeenCalledWith({ id: { in: ['study-1', 'study-2'] } });
    expect(mockApprovedStudyDAO.updateMany).toHaveBeenCalledWith(
      { id: { in: ['study-1', 'study-2'] } },
      { programID: 'org-123', updatedAt: expect.any(Date) }
    );
  });

  it('should throw error when study IDs do not exist during organization creation', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
      studies: [
        { studyID: 'study-1' },
        { studyID: 'study-2' }
      ]
    };
    const createdOrg = {
      _id: 'org-123',
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
      status: ORGANIZATION.STATUSES.ACTIVE,
    };
    const existingStudies = [{ id: 'study-1' }]; // Only study-1 exists

    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockProgramDAO.create.mockResolvedValue(createdOrg);
    mockProgramDAO.getOrganizationByID.mockResolvedValue(createdOrg);
    mockApprovedStudyDAO.findMany.mockResolvedValue(existingStudies);

    await expect(organization.createOrganization(params))
      .rejects.toThrow(`Update failed, these provided study IDs do not exist: study-2`);
    
    expect(mockProgramDAO.create).toHaveBeenCalled();
    expect(mockApprovedStudyDAO.findMany).toHaveBeenCalled();
    expect(mockApprovedStudyDAO.updateMany).not.toHaveBeenCalled();
  });

  it('should throw when assigning studies to an inactive program via createOrganization', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
      studies: [{ studyID: 'study-1' }]
    };
    const createdOrg = { _id: 'org-123', name: 'Test Org', abbreviation: 'TST', description: 'desc', status: ORGANIZATION.STATUSES.INACTIVE };
    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockProgramDAO.create.mockResolvedValue(createdOrg);
    mockProgramDAO.getOrganizationByID.mockResolvedValue(createdOrg);

    await expect(organization.createOrganization(params)).rejects.toThrow(
      SUBMODULE_ERROR.STUDIES_CANNOT_ASSIGN_TO_INACTIVE_PROGRAM
    );
    expect(mockApprovedStudyDAO.findMany).not.toHaveBeenCalled();
  });

  it('should throw when organization does not exist while updating studies programID', async () => {
    const params = {
      name: 'Test Org',
      abbreviation: 'TST',
      description: 'desc',
      studies: [{ studyID: 'study-1' }],
    };
    const createdOrg = { _id: 'org-missing', name: 'Test Org', abbreviation: 'TST', description: 'desc' };
    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockProgramDAO.create.mockResolvedValue(createdOrg);
    mockProgramDAO.getOrganizationByID.mockResolvedValue(null);

    await expect(organization.createOrganization(params)).rejects.toThrow(SUBMODULE_ERROR.ORG_NOT_FOUND);
    expect(mockProgramDAO.create).toHaveBeenCalled();
    expect(mockApprovedStudyDAO.findMany).not.toHaveBeenCalled();
  });
});

describe('Organization.getOrganizationAPI', () => {
  let organization;
  let mockProgramDAO;
  let mockUserDAO;
  let mockSubmissionDAO;
  let mockApplicationDAO;
  let mockApprovedStudyDAO;

  beforeEach(() => {
    mockProgramDAO = { getOrganizationByID: jest.fn() };
    mockUserDAO = {};
    mockSubmissionDAO = {};
    mockApplicationDAO = {};
    mockApprovedStudyDAO = {};
    ProgramDAO.mockImplementation(() => mockProgramDAO);
    UserDAO.mockImplementation(() => mockUserDAO);
    SubmissionDAO.mockImplementation(() => mockSubmissionDAO);
    ApplicationDAO.mockImplementation(() => mockApplicationDAO);
    ApprovedStudyDAO.mockImplementation(() => mockApprovedStudyDAO);
    organization = new Organization(
      {}, {}, {}, {}, {}
    );
    jest.clearAllMocks();
  });

  const context = { userInfo: { email: 'test@email.com', IDP: 'test-idp' } };

  it('should return the organization for a valid orgID', async () => {
    const params = { orgID: 'org123' };
    const mockOrg = { _id: 'org123', name: 'Test Org' };
    mockProgramDAO.getOrganizationByID.mockResolvedValue(mockOrg);
    const result = await organization.getOrganizationAPI(params, context);
    expect(result).toEqual(mockOrg);
    expect(mockProgramDAO.getOrganizationByID).toHaveBeenCalledWith('org123');
  });

  it('should throw error if orgID is missing', async () => {
    await expect(organization.getOrganizationAPI({}, context)).rejects.toThrow(ERROR.INVALID_ORG_ID);
  });

  it('should throw error if not logged in', async () => {
    const params = { orgID: 'org123' };
    const badContext = { userInfo: {} };
    await expect(organization.getOrganizationAPI(params, badContext)).rejects.toThrow(ERROR.NOT_LOGGED_IN);
  });
});

describe('Organization.editOrganization', () => {
  let organization;
  let mockProgramDAO;
  let mockUserDAO;
  let mockSubmissionDAO;
  let mockApplicationDAO;
  let mockApprovedStudyDAO;

  beforeEach(() => {
    mockProgramDAO = { 
      getOrganizationByID: jest.fn(), 
      getOrganizationByName: jest.fn(),
      updateMany: jest.fn() 
    };
    mockUserDAO = { findFirst: jest.fn(), updateUserOrg: jest.fn() };
    mockSubmissionDAO = {};
    mockApplicationDAO = { updateApplicationOrg: jest.fn() };
    mockApprovedStudyDAO = { findMany: jest.fn(), updateMany: jest.fn(), count: jest.fn() };
    
    ProgramDAO.mockImplementation(() => mockProgramDAO);
    UserDAO.mockImplementation(() => mockUserDAO);
    SubmissionDAO.mockImplementation(() => mockSubmissionDAO);
    ApplicationDAO.mockImplementation(() => mockApplicationDAO);
    ApprovedStudyDAO.mockImplementation(() => mockApprovedStudyDAO);
    
    organization = new Organization({}, {}, {}, {}, {});
    jest.clearAllMocks();
  });

  it('should edit organization and update studies successfully', async () => {
    const orgID = 'org-123';
    const params = {
      name: 'Updated Org',
      studies: [
        { studyID: 'study-1' },
        { studyID: 'study-2' }
      ]
    };
    const currentOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST', status: ORGANIZATION.STATUSES.ACTIVE };
    const existingStudies = [
      { id: 'study-1' },
      { id: 'study-2' }
    ];

    mockProgramDAO.getOrganizationByID.mockResolvedValue(currentOrg);
    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockProgramDAO.updateMany.mockResolvedValue({ acknowledged: true });
    mockApprovedStudyDAO.findMany.mockResolvedValue(existingStudies);
    mockApprovedStudyDAO.updateMany.mockResolvedValue({ count: 2 });

    const result = await organization.editOrganization(orgID, params);
    
    expect(result).toEqual({ ...currentOrg, name: 'Updated Org', updateAt: expect.any(Date) });
    expect(mockProgramDAO.updateMany).toHaveBeenCalled();
    expect(mockApprovedStudyDAO.findMany).toHaveBeenCalledWith({ id: { in: ['study-1', 'study-2'] } });
    expect(mockApprovedStudyDAO.updateMany).toHaveBeenCalledWith(
      { id: { in: ['study-1', 'study-2'] } },
      { programID: orgID, updatedAt: expect.any(Date) }
    );
  });

  it('should edit organization without updating studies when studies array is empty', async () => {
    const orgID = 'org-123';
    const params = {
      name: 'Updated Org',
      studies: []
    };
    const currentOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST' };

    mockProgramDAO.getOrganizationByID.mockResolvedValue(currentOrg);
    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockProgramDAO.updateMany.mockResolvedValue({ acknowledged: true });

    const result = await organization.editOrganization(orgID, params);
    
    expect(result).toEqual({ ...currentOrg, name: 'Updated Org', updateAt: expect.any(Date) });
    expect(mockProgramDAO.updateMany).toHaveBeenCalled();
    expect(mockApprovedStudyDAO.findMany).not.toHaveBeenCalled();
    expect(mockApprovedStudyDAO.updateMany).not.toHaveBeenCalled();
  });

  it('should throw error when study IDs do not exist during organization edit', async () => {
    const orgID = 'org-123';
    const params = {
      name: 'Updated Org',
      studies: [
        { studyID: 'study-1' },
        { studyID: 'study-2' }
      ]
    };
    const currentOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST', status: ORGANIZATION.STATUSES.ACTIVE };
    const existingStudies = [{ id: 'study-1' }]; // Only study-1 exists

    mockProgramDAO.getOrganizationByID.mockResolvedValue(currentOrg);
    mockProgramDAO.getOrganizationByName.mockResolvedValue(null);
    mockProgramDAO.updateMany.mockResolvedValue({ acknowledged: true });
    mockApprovedStudyDAO.findMany.mockResolvedValue(existingStudies);

    await expect(organization.editOrganization(orgID, params))
      .rejects.toThrow(`Update failed, these provided study IDs do not exist: study-2`);
    
    expect(mockProgramDAO.updateMany).toHaveBeenCalled();
    expect(mockApprovedStudyDAO.findMany).toHaveBeenCalled();
    expect(mockApprovedStudyDAO.updateMany).not.toHaveBeenCalled();
  });

  it(`should throw when setting status ${ORGANIZATION.STATUSES.INACTIVE} while program has assigned studies`, async () => {
    const orgID = 'org-123';
    const currentOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST' };
    mockProgramDAO.getOrganizationByID.mockResolvedValue(currentOrg);
    mockApprovedStudyDAO.count.mockResolvedValue(2);

    await expect(organization.editOrganization(orgID, { status: ORGANIZATION.STATUSES.INACTIVE })).rejects.toThrow(
      SUBMODULE_ERROR.PROGRAM_CANNOT_INACTIVATE_WITH_STUDIES
    );
    expect(mockProgramDAO.updateMany).not.toHaveBeenCalled();
  });

  it(`should throw when setting status ${ORGANIZATION.STATUSES.INACTIVE} and studies are provided in the same request`, async () => {
    const orgID = 'org-123';
    const currentOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST' };
    mockProgramDAO.getOrganizationByID.mockResolvedValue(currentOrg);
    mockApprovedStudyDAO.count.mockResolvedValue(0);

    await expect(
      organization.editOrganization(orgID, { status: ORGANIZATION.STATUSES.INACTIVE, studies: [{ studyID: 'study-1' }] })
    ).rejects.toThrow(SUBMODULE_ERROR.STUDIES_CANNOT_ASSIGN_TO_INACTIVE_PROGRAM);
    expect(mockProgramDAO.updateMany).not.toHaveBeenCalled();
  });

  it('should omit duplicate-name lookup when only status is updated (no name in params)', async () => {
    const orgID = 'org-123';
    const currentOrg = {
      _id: orgID,
      name: 'Test Org',
      abbreviation: 'TST',
      status: ORGANIZATION.STATUSES.ACTIVE
    };
    mockProgramDAO.getOrganizationByID.mockResolvedValue(currentOrg);
    mockApprovedStudyDAO.count.mockResolvedValue(0);
    mockProgramDAO.updateMany.mockResolvedValue({ acknowledged: true });
    mockProgramDAO.getOrganizationByName.mockResolvedValue({ _id: 'other-id', name: 'collision' });

    const result = await organization.editOrganization(orgID, { status: ORGANIZATION.STATUSES.INACTIVE });

    expect(mockProgramDAO.getOrganizationByName).not.toHaveBeenCalled();
    expect(mockProgramDAO.updateMany).toHaveBeenCalledWith(
      { id: orgID },
      expect.objectContaining({ status: ORGANIZATION.STATUSES.INACTIVE, updateAt: expect.any(Date) })
    );
    expect(result.status).toBe(ORGANIZATION.STATUSES.INACTIVE);
  });

  it('should set status Active when explicitly requested', async () => {
    const orgID = 'org-123';
    const currentOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST', status: ORGANIZATION.STATUSES.INACTIVE };
    mockProgramDAO.getOrganizationByID.mockResolvedValue(currentOrg);
    mockProgramDAO.updateMany.mockResolvedValue({ acknowledged: true });

    const result = await organization.editOrganization(orgID, { status: ORGANIZATION.STATUSES.ACTIVE });

    expect(result.status).toBe(ORGANIZATION.STATUSES.ACTIVE);
    expect(mockProgramDAO.updateMany).toHaveBeenCalledWith(
      { id: orgID },
      expect.objectContaining({ status: ORGANIZATION.STATUSES.ACTIVE, updateAt: expect.any(Date) })
    );
  });

  it('should throw when assigning studies to an inactive program via editOrganization', async () => {
    const orgID = 'org-123';
    const inactiveOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST', status: ORGANIZATION.STATUSES.INACTIVE };
    const params = {
      name: 'Test Org',
      studies: [{ studyID: 'study-1' }]
    };
    mockProgramDAO.getOrganizationByID.mockResolvedValue(inactiveOrg);
    mockProgramDAO.updateMany.mockResolvedValue({ acknowledged: true });

    await expect(organization.editOrganization(orgID, params)).rejects.toThrow(
      SUBMODULE_ERROR.STUDIES_CANNOT_ASSIGN_TO_INACTIVE_PROGRAM
    );
    expect(mockProgramDAO.updateMany).not.toHaveBeenCalled();
    expect(mockApprovedStudyDAO.findMany).not.toHaveBeenCalled();
  });

  it('should allow assigning studies when reactivating program in the same request', async () => {
    const orgID = 'org-123';
    const inactiveOrg = { _id: orgID, name: 'Test Org', abbreviation: 'TST', status: ORGANIZATION.STATUSES.INACTIVE };
    const reactivatedOrg = { ...inactiveOrg, status: ORGANIZATION.STATUSES.ACTIVE };
    const params = {
      name: 'Test Org',
      status: ORGANIZATION.STATUSES.ACTIVE,
      studies: [{ studyID: 'study-1' }]
    };
    mockProgramDAO.getOrganizationByID
      .mockResolvedValueOnce(inactiveOrg)
      .mockResolvedValue(reactivatedOrg);
    mockProgramDAO.updateMany.mockResolvedValue({ acknowledged: true });
    mockApprovedStudyDAO.findMany.mockResolvedValue([{ id: 'study-1' }]);
    mockApprovedStudyDAO.updateMany.mockResolvedValue({ count: 1 });

    const result = await organization.editOrganization(orgID, params);

    expect(mockProgramDAO.updateMany).toHaveBeenCalled();
    expect(mockApprovedStudyDAO.findMany).toHaveBeenCalled();
    expect(result.status).toBe(ORGANIZATION.STATUSES.ACTIVE);
  });

  it('should reject inactivating a read-only program (e.g. system catch-all)', async () => {
    const orgID = 'readonly-org-id';
    const currentOrg = {
      _id: orgID,
      name: 'NA',
      abbreviation: 'NA',
      readOnly: true,
      status: ORGANIZATION.STATUSES.ACTIVE
    };
    mockProgramDAO.getOrganizationByID.mockResolvedValue(currentOrg);

    await expect(organization.editOrganization(orgID, { status: ORGANIZATION.STATUSES.INACTIVE })).rejects.toThrow(
      SUBMODULE_ERROR.CANNOT_UPDATE_READ_ONLY_PROGRAM
    );
    expect(mockProgramDAO.updateMany).not.toHaveBeenCalled();
  });
});
