import { styled } from "@mui/material";
import { Link } from "react-router-dom";

import FooterData from "../../config/FooterConfig";

import NewsletterForm from "./NewsletterForm";

const StyledFooter = styled("footer")({
  backgroundColor: "#1B496E",
  borderTop: "1px solid #6C727B",
  bottom: 0,
  width: "100%",
  position: "relative",
});

const FooterContainer = styled("div")({
  padding: "2rem 1rem 0 1rem",
  maxWidth: "1420px",
  marginLeft: "auto",
  marginRight: "auto",
  display: "flex",
  justifyContent: "space-between",
});

const StyledNewsletterForm = styled(NewsletterForm)({
  width: "33.3%",
  "& .signUpTitle": {
    fontFamily: "poppins",
    fontWeight: 700,
    fontSize: "22.88px",
    lineHeight: "34px",
    color: "#FFFFFF",
    marginBottom: "1rem",
  },
  "& .enterTitle": {
    fontFamily: "Open Sans",
    fontWeight: 400,
    fontSize: "16px",
    lineHeight: "22px",
    color: "#FFFFFF",
    marginBottom: "10px",
  },
  "& .signUpInputBox": {
    width: "100%",
    height: "47px",
    fontSize: "25px",
    paddingLeft: "8px",
    marginTop: "4px",
    "&:focus": {
      outline: "0.25rem solid #2491ff",
    },
  },
  "& .signUpButton": {
    background: "#FACE00",
    borderRadius: "8px",
    border: 0,
    padding: "9px 16px",
    fontFamily: "Open Sans",
    fontWeight: 700,
    fontSize: "16px",
    lineHeight: "22px",
    color: "#14315C",
    marginTop: "18px",
    "&:hover": {
      cursor: "pointer",
    },
  },
});

const FooterLinksContainer = styled("div")({
  width: "66.7%",
  display: "grid",
  gridColumnGap: "4%",
  gridTemplateColumns: "46% 46%",
  "& .footItem": {
    paddingBottom: "32px",
    marginBottom: "24px",
  },
  "& .footItemTitle": {
    fontFamily: "Open Sans",
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: "16px",
    lineHeight: "22px",
    marginBottom: "10px",
  },
  "& .footItemSubtitle": {
    marginBottom: "10px",
    maxWidth: "290px",
    fontFamily: "Open Sans",
    color: "#FFFFFF",
    fontWeight: 400,
    fontSize: "16px",
    lineHeight: "22px",
  },
  "& .footItemLink": {
    color: "inherit",
    textDecoration: "none",
    "&:hover": {
      textDecoration: "underline",
    },
  },
});

const BottomFooter = styled("div")({
  background: "#14315C",
  "& span": {
    display: "block",
  },
  "& .bottom-footer-container": {
    display: "flex",
    flexFlow: "wrap",
    flexDirection: "column",
    justifyContent: "space-between",
    maxWidth: "1420px",
    marginLeft: "auto",
    marginRight: "auto",
    height: "fit-content",
    paddingTop: "1.25rem",
    paddingBottom: "1.25rem",
    paddingLeft: "1rem",
  },
  "& .break": {
    order: 2,
    width: "100%",
    flexBasis: "100%",
    height: "2rem",
    margin: 0,
    border: 0,
    display: "none",
  },
  "& .logoText": {
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  "& .logoUpperText": {
    fontFamily: "poppins",
    fontWeight: 700,
    fontSize: "24.96px",
    lineHeight: "37px",
    color: "#FFFFFF",
  },
  "& .logoLowerText": {
    fontFamily: "poppins",
    fontWeight: 400,
    fontSize: "18.72px",
    color: "#FFFFFF",
  },
  "& #bottom-footer-contact-us": {
    fontFamily: "Poppins",
    fontStyle: "normal",
    fontWeight: 700,
    fontSize: "22.88px",
    lineHeight: "34px",
    textAlign: "left",
    color: "#FFFFFF",
    order: 1,
    marginTop: "1.5rem",
  },
  "& #bottom-footer-contact-links": {
    fontFamily: "Open Sans",
    fontStyle: "normal",
    fontWeight: 400,
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#FFFFFF",
    marginTop: "0.25rem",
    "& a": {
      textDecoration: "none",
      color: "#FFFFFF",
      display: "block",
      marginLeft: "0px",
      marginRight: "10px",
    },
  },
  "& #bottom-footer-follow-us": {
    fontFamily: "Poppins",
    fontStyle: "normal",
    fontWeight: 700,
    fontSize: "22.88px",
    lineHeight: "34px",
    color: "#FFFFFF",
    order: 3,
    marginTop: "1rem",
  },
  "& #bottom-footer-follow-us-links": {
    marginTop: "0.75rem",
  },
  "& .bottom-footer-social-media-imgs": {
    marginLeft: "10px",
  },
  "& #bottom-footer-gov-links": {
    order: 4,
    marginRight: "0px",
    marginTop: "0.75rem",
    "& a": {
      textDecoration: "none",
      display: "block",
      fontFamily: "Open Sans",
      fontStyle: "normal",
      fontWeight: 400,
      fontSize: "14px",
      lineHeight: "1.6",
      textAlign: "left",
      color: "#FFFFFF",
    },
  },
});

const FooterTablet = () => (
  <StyledFooter role="contentinfo" data-testid="tablet-footer">
    <FooterContainer>
      <FooterLinksContainer>
        {FooterData.link_sections.map((linkItem) => (
          <div className="footItem" key={`link_${linkItem.title}`}>
            <div className="footItemTitle">{linkItem.title}</div>
            {linkItem.items.map((item) => {
              if (typeof item?.link !== "string") {
                return (
                  <div className="footItemSubtitle" key={item?.text}>
                    {item.text}
                  </div>
                );
              }

              return (
                <div className="footItemSubtitle" key={`item_${item.text}`}>
                  {item.link.includes("http") ? (
                    <a
                      className="footItemLink"
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.text}
                    </a>
                  ) : (
                    <Link className="footItemLink" to={item.link}>
                      {item.text}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </FooterLinksContainer>
      <StyledNewsletterForm />
    </FooterContainer>

    <BottomFooter>
      <div className="bottom-footer-container">
        <div id="bottom-footer-header">
          <a
            className="logoText"
            href="https://www.cancer.gov"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="logoUpperText">National Cancer Institute</div>
            <div className="logoLowerText">at the National Institutes of Health</div>
          </a>
        </div>
        <div id="bottom-footer-contact-us">
          Contact Us
          <div id="bottom-footer-contact-links">
            {FooterData.contact_links.map((contactItem) =>
              contactItem.link.includes("http") ? (
                <a
                  key={contactItem.link}
                  href={contactItem.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {contactItem.text}
                </a>
              ) : (
                <a key={contactItem.link} href={contactItem.link}>
                  {contactItem.text}
                </a>
              )
            )}
          </div>
        </div>
        <div className="break" />
        <div id="bottom-footer-follow-us">
          Follow Us
          <div id="bottom-footer-follow-us-links">
            {FooterData.followUs_links.map((followItem, ind) => (
              <a
                key={followItem.link}
                className={ind !== 0 ? "bottom-footer-social-media-imgs" : ""}
                href={followItem.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={followItem.img} alt={followItem.description} />
              </a>
            ))}
          </div>
        </div>
        <div id="bottom-footer-gov-links">
          {FooterData.global_footer_links.map((linkItem) => (
            <a key={linkItem.link} href={linkItem.link} target="_blank" rel="noopener noreferrer">
              {linkItem.text}
            </a>
          ))}
        </div>
      </div>
    </BottomFooter>
  </StyledFooter>
);

export default FooterTablet;
