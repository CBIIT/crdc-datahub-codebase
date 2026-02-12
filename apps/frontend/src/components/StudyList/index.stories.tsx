import type { Meta, StoryObj } from "@storybook/react";

import StudyList from "./index";

const meta: Meta<typeof StudyList> = {
  title: "Miscellaneous / StudyList",
  component: StudyList,
  tags: ["autodocs"],
} satisfies Meta<typeof StudyList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A scenario in which only one study is provided.
 */
export const Single: Story = {
  args: {
    studies: [{ _id: "study-1", studyName: "Study One" }],
  },
};

/**
 * A scenario in which multiple studies are provided.
 *
 * Will include a tooltip with the full list of studies.
 */
export const Multiple: Story = {
  args: {
    studies: [
      { _id: "study-1", studyName: "Study One" },
      { _id: "study-2", studyName: "Study Two", studyAbbreviation: "ST2-ABBR" },
      { _id: "study-3", studyName: "Study Three" },
    ],
  },
};

/**
 * A special scenario in which the "All" study is provided.
 */
export const AllStudies: Story = {
  args: {
    studies: [{ _id: "All" }],
  },
};

/**
 * No studies are provided
 */
export const None: Story = {
  args: {
    studies: [],
  },
};

/**
 * A scenario where a long study name needs to be wrapped
 * in order to fit within the parent container.
 */
export const WordWrap: Story = {
  args: {
    studies: [
      { _id: "long-study", studyName: "A".repeat(100) },
      { _id: "study-1", studyName: "Study One" },
      { _id: "study-2", studyName: "Study Two", studyAbbreviation: "ST2-ABBR" },
      { _id: "study-3", studyName: "Study Three" },
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ width: "300px" }}>
        <Story />
      </div>
    ),
  ],
};
