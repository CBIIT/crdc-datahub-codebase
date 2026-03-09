type NavBarItem = {
  /**
   * The unique id attribute of the Navigation Item
   *
   * @note This is also used as the React key.
   */
  id: string;
  /**
   * The name to be displayed on the Navigation Item
   */
  name: string;
  /**
   * The link to navigate to when the Navigation Item is clicked
   */
  link?: string;
  /**
   * The class name of the Navigation Item
   *
   * Guide:
   * - `navMobileItem` if the item does not have a dropdown
   * - `navMobileItem clickable` if the item has a dropdown
   */
  className: "navMobileItem" | "navMobileItem clickable";
  /**
   * Defines a list of permissions necessary for the Navigation Item to be shown
   *
   * Guide:
   * - Provide a list of permission the user must have to access the content
   *   otherwise it will be hidden
   */
  permissions?: AuthPermissions[];
  /**
   * Defines the columns of sub-navigation items
   */
  columns?: NavBarSubItem[][];
};

type NavBarSubItem = {
  /**
   * The unique id attribute of the Navigation Sub Item
   *
   * @note This is also used as the React key.
   */
  id: string;
  /**
   * The name to be displayed on the Navigation Sub Item
   */
  name: string;
  /**
   * The className of the Navigation Sub Item
   *
   * Guide:
   * - `navMobileSubItem` if the item is a link
   * - `navMobileSubTitle` if the item is a title
   * - `navMobileSubItem action` if the item is an action with onClick
   */
  className: "navMobileSubItem" | "navMobileSubTitle" | "navMobileSubItem action";
  /**
   * The link to navigate to when the Navigation Sub Item is clicked
   *
   * @note Should not be provided if the item is an action
   */
  link?: string;
  /**
   * The title to display on the Navigation Sub Item
   *
   * @note Only works if the className is `navMobileSubTitle`
   */
  text?: string;
  /**
   * Defines a list of permissions necessary for the Navigation Sub Item to be shown
   *
   * Guide:
   * - Provide a list of permission the user must have to access the content
   *   otherwise it will be hidden
   */
  permissions?: AuthPermissions[];
  /**
   * A unique identifier to define an action to take place when thhe item is clicked
   */
  actionId?: string;
};

type FooterConfiguration = {
  /**
   * The image source of the footer logo
   *
   * @note The ideal image size 310x80 px
   */
  footerLogoImage: string;
  /**
   * The alt text of the footer logo
   */
  footerLogoAltText: string;
  /**
   * The hyperlink of the footer logo
   */
  footerLogoHyperlink: string;
  /**
   * The static text displayed on the footer
   */
  footerStaticText: string;
  /**
   * An array of footer columns
   */
  link_sections: FooterColumnSection[];
  /**
   * The follow us links
   *
   * @TODO Refactor this to use {@link FooterLinkItem}
   */
  followUs_links: FooterFollowUsLink[];
  /**
   * An array of Contact Us links
   */
  contact_links: FooterLinkItem[];
  /**
   * An array of Anchor Links
   */
  global_footer_links: FooterLinkItem[];
};

/**
 * Represents a independent column section of the footer
 */
type FooterColumnSection = {
  /**
   * Section title
   */
  title: string;
  /**
   * The items in the section
   */
  items: FooterLinkItem[];
};

type FooterLinkItem = {
  /**
   * The text to be displayed on the link
   */
  text: string;
  /**
   * The fully-qualified URL of the link or the relative path
   *
   * @note Omission of this field will render the item as a non-clickable text
   */
  link?: string;
};

type FooterFollowUsLink = {
  img: string;
  link: string;
  description: string;
};
