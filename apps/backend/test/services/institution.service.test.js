const { InstitutionService } = require('../../services/institution-service');
const { INSTITUTION } = require('../../crdc-datahub-database-drivers/constants/organization-constants');
const ERROR = require('../../constants/error-constants');
const { ADMIN } = require('../../crdc-datahub-database-drivers/constants/user-permission-constants');
const { TEST_SESSION } = require('../test-constants');

jest.mock('../../verifier/user-info-verifier', () => ({
  verifySession: jest.fn()
}));
const { verifySession } = require('../../verifier/user-info-verifier');
const { replaceErrorString } = require('../../utility/string-util');

const mockAuthorizationService = {
  getPermissionScope: jest.fn()
};

const mockInstitutionDAO = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  listInstitution: jest.fn(),
  findAll: jest.fn(),
  findByCaseInsensitiveName: jest.fn(),
  createMany: jest.fn()
};

jest.mock('../../dao/institution', () => {
  return jest.fn().mockImplementation(() => mockInstitutionDAO);
});

const validContext = { ...TEST_SESSION };
const validUserScope = {
  isNoneScope: () => false,
  isAllScope: () => true
};
const noneScope = {
  isNoneScope: () => true,
  isAllScope: () => false
};

function setupVerifySession(initialized = true) {
  verifySession.mockReturnValue({
    verifyInitialized: jest.fn().mockImplementation(function () {
      if (!initialized) throw new Error(ERROR.SESSION_NOT_INITIALIZED);
      return this;
    })
  });
}

describe('InstitutionService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InstitutionService(mockAuthorizationService);
    setupVerifySession(true);
    mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'all', scopeValues: [] }]);
  });

  describe('listInstitutions', () => {
    it('returns institutions from DAO', async () => {
      const params = { name: 'foo', offset: 0, first: 10, orderBy: 'name', sortDirection: 'asc', status: INSTITUTION.STATUSES.ACTIVE };
      const expected = { institutions: [{ name: 'foo' }], total: 1 };
      mockInstitutionDAO.listInstitution.mockResolvedValue(expected);
      const result = await service.listInstitutions(params, validContext);
      expect(result).toBe(expected);
      expect(mockInstitutionDAO.listInstitution).toHaveBeenCalledWith(
        params.name, params.offset, params.first, params.orderBy, params.sortDirection, params.status
      );
    });
    it('throws if session is not initialized', async () => {
      setupVerifySession(false);
      await expect(service.listInstitutions({}, validContext)).rejects.toThrow(ERROR.SESSION_NOT_INITIALIZED);
    });
  });

  describe('getInstitution', () => {
    it('returns institution if found and user has permission', async () => {
      mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'all', scopeValues: [] }]);
      mockInstitutionDAO.findById.mockResolvedValue({ _id: 'id1', name: 'foo' });
      const params = { _id: 'id1' };
      const result = await service.getInstitution(params, validContext);
      expect(result).toEqual({ _id: 'id1', name: 'foo' });
    });
    it('throws if user has no permission', async () => {
      mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'none', scopeValues: [] }]);
      service._getUserScope = jest.fn().mockResolvedValue(noneScope);
      await expect(service.getInstitution({ _id: 'id1' }, validContext)).rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
    });
    it('throws if institution not found', async () => {
      mockInstitutionDAO.findById.mockResolvedValue(null);
      await expect(service.getInstitution({ _id: 'notfound' }, validContext)).rejects.toThrow(replaceErrorString(ERROR.INSTITUTION_ID_NOT_EXIST, 'notfound'));
    });
  });

  describe('createInstitution', () => {
    beforeEach(() => {
      service._getUserScope = jest.fn().mockResolvedValue(validUserScope);
      mockInstitutionDAO.findByCaseInsensitiveName.mockResolvedValue(null);
    });
    it('creates institution successfully', async () => {
      mockInstitutionDAO.create.mockResolvedValue({ _id: 'id1', name: 'foo', status: INSTITUTION.STATUSES.ACTIVE });
      const params = { name: 'foo', status: INSTITUTION.STATUSES.ACTIVE };
      const result = await service.createInstitution(params, validContext);
      expect(result).toEqual({ _id: 'id1', name: 'foo', status: INSTITUTION.STATUSES.ACTIVE });
      expect(mockInstitutionDAO.findByCaseInsensitiveName).toHaveBeenCalledWith('foo');
    });
    it('throws if user has no permission', async () => {
      service._getUserScope = jest.fn().mockResolvedValue(noneScope);
      await expect(service.createInstitution({ name: 'foo' }, validContext)).rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
    });
    it('throws if name is empty', async () => {
      await expect(service.createInstitution({ name: '   ' }, validContext)).rejects.toThrow(ERROR.EMPTY_INSTITUTION_NAME);
    });
    it('throws if status is invalid', async () => {
      await expect(service.createInstitution({ name: 'foo', status: 'bad' }, validContext)).rejects.toThrow(ERROR.INVALID_INSTITUTION_STATUS.replace('$item$', 'bad'));
    });
    it('throws if institution name is duplicate', async () => {
      mockInstitutionDAO.findByCaseInsensitiveName.mockResolvedValue({ _id: 'id1', name: 'duplicate' });
      await expect(service.createInstitution({ name: 'foo' }, validContext)).rejects.toThrow(ERROR.DUPLICATE_INSTITUTION_NAME);
    });
    it('throws if name is too long', async () => {
      const longName = 'a'.repeat(101);
      await expect(service.createInstitution({ name: longName }, validContext)).rejects.toThrow(ERROR.MAX_INSTITUTION_NAME_LIMIT);
    });
    it('throws if DAO create fails', async () => {
      mockInstitutionDAO.create.mockResolvedValue(null);
      await expect(service.createInstitution({ name: 'foo' }, validContext)).rejects.toThrow(ERROR.FAILED_CREATE_INSTITUTION);
    });
  });

  describe('updateInstitution', () => {
    beforeEach(() => {
      service._getUserScope = jest.fn().mockResolvedValue(validUserScope);
      mockInstitutionDAO.findByCaseInsensitiveName.mockResolvedValue(null);
    });
    it('updates institution successfully', async () => {
      const params = { _id: 'id1', name: 'bar', status: INSTITUTION.STATUSES.ACTIVE };
      const existing = { _id: 'id1', name: 'foo', status: INSTITUTION.STATUSES.INACTIVE };
      const updated = { ...existing, ...params };
      mockInstitutionDAO.findById.mockResolvedValue(existing);
      mockInstitutionDAO.update.mockResolvedValue(updated);
      const result = await service.updateInstitution(params, validContext);
      expect(result).toEqual(updated);
      expect(mockInstitutionDAO.update).toHaveBeenCalledWith('id1', expect.objectContaining({
        name: 'bar',
        status: INSTITUTION.STATUSES.ACTIVE,
      }));
    });
    it('returns original if no changes', async () => {
      const params = { _id: 'id1', name: 'foo', status: INSTITUTION.STATUSES.INACTIVE };
      const existing = { _id: 'id1', name: 'foo', status: INSTITUTION.STATUSES.INACTIVE };
      mockInstitutionDAO.findById.mockResolvedValue(existing);
      const result = await service.updateInstitution(params, validContext);
      expect(result).toEqual(existing);
      expect(mockInstitutionDAO.update).not.toHaveBeenCalled();
    });
    it('throws if user has no permission', async () => {
      service._getUserScope = jest.fn().mockResolvedValue(noneScope);
      await expect(service.updateInstitution({ _id: 'id1', name: 'foo' }, validContext)).rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
    });

    it('throws if institution not found', async () => {
      mockInstitutionDAO.findById.mockResolvedValueOnce(null);
      await expect(service.updateInstitution({ _id: 'notfound', name: 'foo' }, validContext)).rejects.toThrow(replaceErrorString(ERROR.INSTITUTION_ID_NOT_EXIST, 'notfound'));
    });
    it('throws if name is empty', async () => {
      const existing = { _id: 'id1', name: 'foo', status: INSTITUTION.STATUSES.INACTIVE };
      mockInstitutionDAO.findById.mockResolvedValue(existing);
      await expect(service.updateInstitution({ _id: 'id1', name: '   ' }, validContext)).rejects.toThrow(ERROR.EMPTY_INSTITUTION_NAME);
    });
    it('throws if name is too long', async () => {
      const existing = { _id: 'id1', name: 'foo', status: INSTITUTION.STATUSES.INACTIVE };
      mockInstitutionDAO.findById.mockResolvedValue(existing);
      await expect(service.updateInstitution({ _id: 'id1', name: 'a'.repeat(101) }, validContext)).rejects.toThrow(ERROR.MAX_INSTITUTION_NAME_LIMIT);
    });
    it('throws if duplicate name', async () => {
      const existing = { _id: 'id1', name: 'foo', status: INSTITUTION.STATUSES.INACTIVE };
      mockInstitutionDAO.findById.mockResolvedValue(existing);
      mockInstitutionDAO.findByCaseInsensitiveName.mockResolvedValue({ _id: 'id2', name: 'bar' });
      await expect(service.updateInstitution({ _id: 'id1', name: 'bar' }, validContext)).rejects.toThrow(ERROR.DUPLICATE_INSTITUTION_NAME);
    });
    it('throws if status is invalid', async () => {
      const existing = { _id: 'id1', name: 'foo', status: INSTITUTION.STATUSES.INACTIVE };
      mockInstitutionDAO.findById.mockResolvedValue(existing);
      await expect(service.updateInstitution({ _id: 'id1', name: 'foo', status: 'bad' }, validContext)).rejects.toThrow(ERROR.INVALID_INSTITUTION_STATUS.replace('$item$', 'bad'));
    });
    it('throws FAILED_UPDATE_INSTITUTION when DAO update fails', async () => {
      const params = { _id: 'id1', name: 'bar', status: INSTITUTION.STATUSES.ACTIVE };
      const existing = { _id: 'id1', name: 'foo', status: INSTITUTION.STATUSES.INACTIVE };
      mockInstitutionDAO.findById.mockResolvedValue(existing);
      mockInstitutionDAO.update.mockRejectedValue(new Error('Failed to update Institution'));
      await expect(service.updateInstitution(params, validContext)).rejects.toThrow(ERROR.FAILED_UPDATE_INSTITUTION);
    });
  });

  describe('addNewInstitutions', () => {
    it('creates only institutions with new names', async () => {
      mockInstitutionDAO.findAll.mockResolvedValue([{ name: 'Existing U' }]);
      mockInstitutionDAO.createMany.mockResolvedValue({ count: 1 });
      const institutionList = [
        { id: 'id-existing', name: 'Existing U' },
        { id: 'id-new', name: 'New U' },
      ];

      await service.addNewInstitutions(institutionList);

      expect(mockInstitutionDAO.createMany).toHaveBeenCalledTimes(1);
      const createdDocs = mockInstitutionDAO.createMany.mock.calls[0][0];
      expect(createdDocs).toHaveLength(1);
      expect(createdDocs[0]).toEqual(expect.objectContaining({
        _id: 'id-new',
        name: 'New U',
        status: INSTITUTION.STATUSES.ACTIVE,
      }));
    });

    it('does not call createMany when all names already exist', async () => {
      mockInstitutionDAO.findAll.mockResolvedValue([{ name: 'Existing U' }]);
      await service.addNewInstitutions([{ id: 'id-existing', name: 'Existing U' }]);
      expect(mockInstitutionDAO.createMany).not.toHaveBeenCalled();
    });
  });
});
