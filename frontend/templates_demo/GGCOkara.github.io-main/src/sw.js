import { precacheAndRoute } from "workbox-precaching/precacheAndRoute";
precacheAndRoute([
  { revision: "23e1e5c71cdc2534c692fd056d56b9c4", url: "about/index.html" },
  {
    revision: "c6bc3cf8b889ef77c7fef68a2e26ec27",
    url: "admissions/index.html",
  },
  { revision: "97c69659b32f9fe9c2b7c98bbf6ad6be", url: "contact/index.html" },
  { revision: "fb9d5795fb0e19dcff86eeb2cfd4199b", url: "courses/index.html" },
  { revision: "1f447254291cbb8371ce5a83b272df58", url: "gallery/index.html" },
  { revision: "749cb9d7e43109f30ac2a01eb0ef4a8b", url: "index.html" },
  { revision: "423ff60d09e606412e3329ab21826b3e", url: "mramzanch/index.html" },
  { revision: "92ea7b9be7107d6bcebf340e73312510", url: "mrc/index.html" },
  { revision: "f9c0ea67a7b89a736891ebe403297120", url: "src/about.css" },
  { revision: "8b62af33959566e41d21ccd33f3a8063", url: "src/admissions.css" },
  { revision: "959290dc4b7b89eb67cee2eace8df1ff", url: "src/contact.css" },
  { revision: "61baf136491797ffbab83327ff41f4ab", url: "src/courses.css" },
  { revision: "41a7a3494b6b0d8090c65f479abd8e65", url: "src/gallery.css" },
  { revision: "8df0dc48e7055f2bb1cdc4bef847594a", url: "src/index.css" },
]);
