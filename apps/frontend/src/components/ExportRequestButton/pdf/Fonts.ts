/**
 * Describes a font resource to be loaded for the PDF generation.
 */
export type FontResource = {
  /**
   * The full URL to the TTF font file.
   */
  src: string;
  /**
   * The font family name.
   *
   * @example "Nunito"
   */
  family: string;
  /**
   * The font style.
   *
   * @example "normal"
   */
  style: string;
  /**
   * The font weight.
   *
   * @example 400
   */
  fontWeight: number;
};

/**
 * Defines the fonts to be loaded for the PDF generation.
 *
 * @note jsPDF does NOT support anything other than ttf fonts. In order to get TTF fonts from Google Fonts,
 * Open the typical Google Fonts CSS URL, then mock your user agent to an old device (e.g. blackberry) and reload the page.
 */
const fonts: Readonly<FontResource[]> = [
  // {
  //   family: "Nunito",
  //   style: "normal",
  //   name: "Nunito-Regular.ttf",
  //   src: "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDOUhRTM.ttf",
  //   fontWeight: 300,
  // },
  {
    family: "Nunito",
    style: "normal",
    src: "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshRTM.ttf",
    fontWeight: 400,
  },
  // {
  //   family: "Nunito",
  //   style: "normal",
  //   src: "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhRTM.ttf",
  //   fontWeight: 500,
  // },
  {
    family: "Nunito",
    style: "normal",
    src: "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDGUmRTM.ttf",
    fontWeight: 600,
  },
  {
    family: "Nunito",
    style: "normal",
    src: "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDFwmRTM.ttf",
    fontWeight: 700,
  },
  {
    family: "Nunito",
    style: "normal",
    src: "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDDsmRTM.ttf",
    fontWeight: 800,
  },
  // {
  //   family: "Nunito",
  //   style: "normal",
  //   name: "Nunito-Regular.ttf",
  //   src: "https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDBImRTM.ttf",
  //   fontWeight: 900,
  // },
  // {
  //   family: "Nunito Sans",
  //   style: "normal",
  //   src: "https://fonts.gstatic.com/s/nunitosans/v15/pe1mMImSLYBIv1o4X1M8ce2xCx3yop4tQpF_MeTm0lfGWVpNn64CL7U8upHZIbMV51Q42ptCp5F5bxqqtQ1yiU4GVi5ntA.ttf",
  //   fontWeight: 800,
  // },
];

export default fonts;
