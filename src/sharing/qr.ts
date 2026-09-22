import QRCode from "qrcode-svg";

// The event link as a vector image, generated on the server (spec, "Sharing"), so a host can
// print it or hold it up at the door and it stays sharp at any size.
export function qrSvg(link: string): string {
  return new QRCode({
    content: link,
    padding: 1,
    // A viewBox rather than fixed pixels, so the page decides how big it is printed.
    container: "svg-viewbox",
    width: 256,
    height: 256,
    color: "#000000",
    background: "#ffffff",
    // Enough redundancy to survive a phone camera at an angle.
    ecl: "M",
    join: true,
    // An XML declaration would land in the page as a stray comment node.
    xmlDeclaration: false,
  }).svg();
}
