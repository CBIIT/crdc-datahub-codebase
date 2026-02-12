/**
 * Configuration for Questionnaire Section D Cell Line Model System
 */
const options: FormGroupCheckboxOption[] = [
  {
    label: "Cell lines",
    value: "Cell lines",
    name: "cellLines",
    tooltipText: "An established cell culture that can be propagated.",
  },
  {
    label: "Model systems",
    value: "Model systems",
    name: "modelSystems",
    tooltipText: "An experimental system that shows similarity to human tumors.",
  },
];

export default options;
