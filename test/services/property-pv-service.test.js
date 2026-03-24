jest.mock('../../verifier/user-info-verifier', () => ({
    verifySession: jest.fn(() => ({
        verifyInitialized: jest.fn()
    }))
}));

const { PropertyPVService } = require('../../services/property-pv-service');
const ERROR = require('../../constants/error-constants');
const { replaceErrorString } = require('../../utility/string-util');

describe('PropertyPVService.retrievePVsByPropertyName', () => {
    let service;
    let configurationService;
    let propertyPVDAO;
    let context;

    beforeEach(() => {
        jest.clearAllMocks();
        configurationService = { findByType: jest.fn() };
        propertyPVDAO = { findByPropertyVersionAndModel: jest.fn() };
        service = new PropertyPVService(configurationService, propertyPVDAO);
        context = { userInfo: { _id: 'u1' } };
    });

    it('throws an error when the provided model is not in the DATA_COMMONS_LIST', async () => {
        configurationService.findByType.mockResolvedValue({ key: ['ICDC', 'CTDC'] });
        await expect(
            service.retrievePVsByPropertyName(
                { propertyName: 'p', model: 'CDS', version: '1' },
                context
            )
        ).rejects.toThrow(
            replaceErrorString(
                replaceErrorString(ERROR.INVALID_DATA_MODEL_NOT_ALLOWED, `'CDS'`),
                'CTDC, ICDC',
                /\$accepted\$/g
            )
        );
        expect(propertyPVDAO.findByPropertyVersionAndModel).not.toHaveBeenCalled();
    });

    it('queries with exact model string passed in', async () => {
        configurationService.findByType.mockResolvedValue({ key: ['CDS', 'ICDC'] });
        propertyPVDAO.findByPropertyVersionAndModel.mockResolvedValue({
            id: 'doc1',
            property: 'study_id',
            model: 'CDS',
            version: '1.0',
            permissibleValues: ['a']
        });

        const result = await service.retrievePVsByPropertyName(
            { propertyName: ' study_id ', model: 'CDS', version: ' 1.0 ' },
            context
        );

        expect(result.property).toBe('study_id');
        expect(propertyPVDAO.findByPropertyVersionAndModel).toHaveBeenCalledWith('study_id', '1.0', 'CDS');
    });

    it('accepts GC when GC is listed and searches for model GC', async () => {
        configurationService.findByType.mockResolvedValue({ key: ['GC', 'ICDC'] });
        propertyPVDAO.findByPropertyVersionAndModel.mockResolvedValue(null);

        await service.retrievePVsByPropertyName(
            { propertyName: 'p', model: 'GC', version: '1' },
            context
        );

        expect(propertyPVDAO.findByPropertyVersionAndModel).toHaveBeenCalledWith('p', '1', 'GC');
    });

    it('returns null when DAO finds no document', async () => {
        configurationService.findByType.mockResolvedValue({ key: ['ICDC'] });
        propertyPVDAO.findByPropertyVersionAndModel.mockResolvedValue(null);

        const result = await service.retrievePVsByPropertyName(
            { propertyName: 'p', model: 'ICDC', version: '1' },
            context
        );

        expect(result).toBeNull();
    });

    it('throws for whitespace-only model', async () => {
        await expect(
            service.retrievePVsByPropertyName(
                { propertyName: 'p', model: '   ', version: '1' },
                context
            )
        ).rejects.toThrow(ERROR.RETRIEVE_PVS_INVALID_MODEL);
        expect(configurationService.findByType).not.toHaveBeenCalled();
    });

    it('throws for empty propertyName before config lookup', async () => {
        await expect(
            service.retrievePVsByPropertyName(
                { propertyName: '', model: 'ICDC', version: '1' },
                context
            )
        ).rejects.toThrow(ERROR.RETRIEVE_PVS_INVALID_PROPERTY_NAME);
        expect(configurationService.findByType).not.toHaveBeenCalled();
    });

    it('throws for whitespace-only version before config lookup', async () => {
        await expect(
            service.retrievePVsByPropertyName(
                { propertyName: 'p', model: 'ICDC', version: '   ' },
                context
            )
        ).rejects.toThrow(ERROR.RETRIEVE_PVS_INVALID_VERSION);
        expect(configurationService.findByType).not.toHaveBeenCalled();
    });

    it('uses trimmed model in the not-allowed error message', async () => {
        configurationService.findByType.mockResolvedValue({ key: ['ICDC'] });
        await expect(
            service.retrievePVsByPropertyName(
                { propertyName: 'p', model: '  CDS  ', version: '1' },
                context
            )
        ).rejects.toThrow(
            replaceErrorString(
                replaceErrorString(ERROR.INVALID_DATA_MODEL_NOT_ALLOWED, `'CDS'`),
                'ICDC',
                /\$accepted\$/g
            )
        );
    });
});
