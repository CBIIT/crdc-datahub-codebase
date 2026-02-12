export const LAYOUT = {
  sheetName: "Instructions",
  rows: {
    title: 2,
    spacing1: 3,
    intro: 4,
    getStarted: 6,
    dependentCells: 12,
    faq: 18,
  },
} as const;

export const CONTENT = {
  title: "Instructions",
  sections: {
    intro: {
      title: "Intro",
      description:
        "The following set of high-level questions are intended to provide insight to the CRDC, related to data storage, access, secondary sharing needs and other requirements of data submitters.",
    },
    getStarted: {
      title: "Get Started",
      description:
        "Consult the table below for guidance on the required entry format for each field type. It explains where and how to provide values for single entries, multiple entries, and multiple records.",
      table: {
        types: ["Single Entry", "Multiple Entries", "Multiple Records"],
        descriptions: [
          "Enter exactly one value in a single row.",
          'Enter multiple values in a single row, separated by a | delimiter.\n(e.g. "value1 | value2 | value3")',
          "Enter multiple records by using a new row for each record. This does not affect adjacent columns; Single Entry fields will remain as a single row.",
        ],
      },
    },
    dependentCells: {
      title: "Dependent Cells",
      descriptions: [
        "- Indicates a derived or dependent field. You do not need to fill it out.",
        "If you type in a blocked cell, your input will be ignored.",
        "To unblock a blocked cell, update the field(s) it depends on.",
      ],
    },
    faq: {
      title: "Frequently Asked Questions (FAQ)",
      questions: [
        {
          question: "Q: What gets ignored?",
          answer:
            "- Stray values that don't match the column's entry type.\n- For Single Entry or Multiple Entry columns, anything typed outside of the second row.\n- Values within blocked cells.",
          rowHeight: 60,
        },
        {
          question: "Q: How can I tell when a field is 'Multiple Entries' or 'Multiple Records'?",
          answer:
            "Hovering over the header cell will display an annotation indicating the field type. If no header annotation is present, then the field is Single Entry.",
          rowHeight: 40,
        },
        {
          question: "Q: What is the Date format?",
          answer: "Dates should be entered in the format MM/DD/YYYY.",
          rowHeight: 20,
        },
        {
          question: "Q: Can I paste values directly into the spreadsheet fields?",
          answer:
            "Pasting data into the Excel form may cause dropdown menus or other features to disappear in some cells. To avoid these issues, use 'Paste Special' and select 'Values', or enter your data manually.",
          rowHeight: 60,
        },
      ],
    },
  },
} as const;
