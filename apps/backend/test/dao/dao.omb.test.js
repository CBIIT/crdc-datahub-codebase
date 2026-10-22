jest.mock('../../dao/configuration');

const getOMBConfiguration = require('../../dao/omb');
const ConfigurationDAO = require('../../dao/configuration');

describe('getOMBConfiguration', () => {
    let findByType;

    beforeEach(() => {
        findByType = jest.fn();
        ConfigurationDAO.mockImplementation(() => ({
            findByType,
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return OMB configuration when found', async () => {
        const mockConfig = { id: 'omb123', _id: 'omb123', type: 'OMB_INFO', OMBNumber: '123' };
        findByType.mockResolvedValue(mockConfig);

        const result = await getOMBConfiguration();

        expect(findByType).toHaveBeenCalledWith('OMB_INFO');
        expect(result).toEqual(mockConfig);
    });

    it('should return null when OMB configuration not found', async () => {
        findByType.mockResolvedValue(null);

        const result = await getOMBConfiguration();

        expect(findByType).toHaveBeenCalledWith('OMB_INFO');
        expect(result).toBeNull();
    });
});
