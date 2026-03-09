import { Dialog, styled } from "@mui/material";
import React, { FC, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import background from "../assets/banner/login_banner.webp";
import { useAuthContext } from "../components/Contexts/AuthContext";

const LoginDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    width: "550px",
    height: "218px",
    borderRadius: "8px",
    border: "2px solid var(--secondary-one, #0B7F99)",
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
  },
  "& .buttonContainer": {
    display: "flex",
    justifyContent: "center",
  },
  "& .loginDialogText": {
    marginTop: "57px",
    fontFamily: "Nunito",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 400,
    lineHeight: "19.6px",
    textAlign: "center",
  },
  "& .loginDialogButton": {
    display: "flex",
    width: "128px",
    height: "42px",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "8px",
    border: "1px solid #000",
    marginTop: "39px",
    textDecoration: "none",
    color: "rgba(0, 0, 0, 0.87)",
    marginLeft: "7px",
    marginRight: "7px",
    "&:hover": {
      cursor: "pointer",
    },
  },
  "& #loginDialogLinkToLogin": {
    color: "black",
  },
});

const PageContentContainer = styled("div")({
  width: "100%",
  height: "633px",
  margin: "auto",
  backgroundImage: `url("${background}")`,
  backgroundBlendMode: "luminosity, normal",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
  display: "flex",
  justifyContent: "center",
  "& .loginPageTextContainer": {
    width: "775px",
    height: "265px",
    display: "flex",
    flexDirection: "column",
    textAlign: "center",
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    borderRadius: "5px",
    border: "2px solid #C8E3FC",
    background: "#091a1961",
    backgroundBlendMode: "multiply",
    boxShadow:
      "-1px -1px 6px 0px rgba(62, 102, 125, 0.25), -1px -1px 6px 0px rgba(76, 121, 147, 0.25)",
  },
  "& .loginPageTextTitle": {
    fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
    fontSize: "40px",
    fontWeight: 800,
    lineHeight: "40px",
    letterSpacing: "-1.5px",
    textAlign: "center",
    color: "#FFFFFF",
    margin: 0,
  },
  "& .loginPageText": {
    fontFamily: "'Inter', 'Rubik', sans-serif",
    fontSize: "16px",
    fontWeight: 400,
    lineHeight: "22px",
    letterSpacing: "0em",
    textAlign: "center",
    marginTop: "30px",
    color: "#86E2F6",
    marginLeft: "30px",
    marginRight: "30px",
  },
  "& .loginPageLoginButton": {
    display: "flex",
    width: "128px",
    height: "51px",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "8px",
    border: "2px solid #005EA2",
    marginTop: "30px",
    textDecoration: "none",
    color: "#3F53B2",
    background: "#FFFFFF",
    "&:hover": {
      cursor: "pointer",
    },
  },
});

const Home: FC = () => {
  const [showRedirectDialog, setShowRedirectDialog] = useState(false);
  const { state } = useLocation();
  const authData = useAuthContext();
  let dialogRedirectPath = state?.path ?? "";
  let dialogLinkName = state?.name ?? "";
  useEffect(() => {
    if (state !== null) {
      dialogRedirectPath = state.path;
      dialogLinkName = state.name;
      setShowRedirectDialog(true);
    }
  }, []);
  return (
    <>
      <LoginDialog open={showRedirectDialog}>
        <pre className="loginDialogText">
          Please{" "}
          <Link
            id="loginDialogLinkToLogin"
            to="/login"
            state={{ redirectState: dialogRedirectPath }}
            onClick={() => setShowRedirectDialog(false)}
          >
            <strong>log in</strong>
          </Link>{" "}
          to access {dialogLinkName}.
        </pre>
        <div className="buttonContainer">
          <div
            role="button"
            tabIndex={0}
            id="loginDialogCloseButton"
            className="loginDialogButton"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setShowRedirectDialog(false);
              }
            }}
            onClick={() => setShowRedirectDialog(false)}
          >
            <strong>Close</strong>
          </div>
          <Link
            id="loginDialogLoginButton"
            className="loginDialogButton"
            to="/login"
            state={{ redirectState: dialogRedirectPath }}
            onClick={() => setShowRedirectDialog(false)}
          >
            <strong>Log In</strong>
          </Link>
        </div>
      </LoginDialog>
      <PageContentContainer>
        {authData.isLoggedIn ? (
          <div className="loginPageTextContainer">
            <h1 className="loginPageTextTitle">Welcome to CRDC Submission Portal</h1>
            <div className="loginPageText">You are logged in.</div>
          </div>
        ) : (
          <div className="loginPageTextContainer">
            <h1 className="loginPageTextTitle">Login to CRDC Submission Portal</h1>
            <div className="loginPageText">
              Please login with a Login.gov account to make a data submission request or to upload
              data for approved submissions
            </div>
            <Link id="loginPageLoginButton" className="loginPageLoginButton" to="/login">
              <strong>Log In</strong>
            </Link>
          </div>
        )}
      </PageContentContainer>
    </>
  );
};

export default Home;
