const { format_dot_notation } = require('../../utility/dot-notation');

describe('format _DOT_ notation before returning it', () => {

    it('should replace only _DOT_ with .', () => {
        const test_object = {
            // only this first key should be replaced
            "parent_DOT_child": "test",
            // these should remain the same
            "parent_dot_child": "test",
            "parentdotchild": "test",
            "parentDOTchild": "test",
            "parent_dotchild": "test",
            "parent_DOTchild": "test",
            "parentdot_child": "test"
        };
        const expected_object = {
            // only this first key should be replaced
            "parent.child": "test",
            // these should remain the same
            "parent_dot_child": "test",
            "parentdotchild": "test",
            "parentDOTchild": "test",
            "parent_dotchild": "test",
            "parent_DOTchild": "test",
            "parentdot_child": "test"
        };

        const formatted_object = format_dot_notation(test_object);

        expect(formatted_object).toEqual(expected_object);
    });

    it('should return the input if it is not an object', () => {
        const testDate = new Date();
        const test_cases = [
            "test",
            0,
            false,
            null,
            undefined,
            [0,1],
            testDate
        ]
        for (const test_case of test_cases) {
            const formatted_object = format_dot_notation(test_case);
            expect(formatted_object).toEqual(test_case);
        }
    });

});
