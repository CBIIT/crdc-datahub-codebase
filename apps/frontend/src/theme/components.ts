import { Components } from "@mui/material";

const components: Components = {
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      text: {
        textTransform: "none",
      },
      contained: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "#FFF",
        borderRadius: "8px",
        textTransform: "none",
        textAlign: "center",
        zIndex: 3,
        "&.Mui-disabled": {
          "&.MuiButton-containedPrimary": {
            fontWeight: 700,
            color: "#FFF",
            border: "1.5px solid #08596C",
            background: "#1A8199",
            opacity: 0.4,
          },
          "&.MuiButton-containedError": {
            fontWeight: 700,
            color: "#FFF",
            border: "1.5px solid #6C2110",
            background: "#B34C36",
            opacity: 0.4,
          },
          "&.MuiButton-containedInfo": {
            fontWeight: 700,
            color: "#EDEDED",
            background: "#B1B1B1",
            border: "1.5px solid #6B7294",
          },
          "& .MuiButton-startIcon, & .MuiButton-endIcon": {
            color: "#EDEDED",
          },
        },
        "&.MuiButton-containedInfo": {
          color: "#000",
        },
        "& .MuiButton-startIcon": {
          position: "absolute",
          left: "11px",
          color: "#6B7294",
        },
        "& .MuiButton-endIcon": {
          position: "absolute",
          right: "11px",
          color: "#6B7294",
        },
      },
      containedPrimary: {
        border: "1.5px solid #08596C",
        fontWeight: 700,
        "&:hover": {
          border: "1.5px solid #08596C",
          background: "#1A8199",
          backgroundImage: "linear-gradient(rgb(0 0 0/15%) 0 0)",
        },
      },
      containedSuccess: {
        border: "1.5px solid #0A6A52",
        fontWeight: 700,
        "&:hover": {
          border: "1.5px solid #0A6A52",
          background: "#1B8369",
          backgroundImage: "linear-gradient(rgb(0 0 0/15%) 0 0)",
        },
      },
      containedError: {
        border: "1.5px solid #6C2110",
        fontWeight: 700,
        "&:hover": {
          border: "1.5px solid #6C2110",
          background: "#B34C36",
          backgroundImage: "linear-gradient(rgb(0 0 0/15%) 0 0)",
        },
      },
      containedInfo: {
        border: "1.5px solid #6B7294",
        fontWeight: 700,
        "&:hover": {
          border: "1.5px solid #6B7294",
          background: "#C0DAF3",
        },
      },
    },
  },
};

export default components;
