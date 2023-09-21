Add [Printcart Designer](https://printcart.com) to your Shopify Store.

## Usage

Add CSS file to header:

```html
<link
  href="https://unpkg.com/@printcart/shopify-integration/dist/style.css"
  rel="stylesheet"
/>
```

Add JS file before the closing body tag:

```html
<script src="https://unpkg.com/@printcart/shopify-integration/dist/main.js"></script>
```

## Options

Add `window.PrintcartDesignerShopifyOptions` variable before our script tag to customize the default UI or extend default functionality:

```js
window.PrintcartDesignerShopifyOptions = {
  designBtnText: "",
  editBtnText: "",
  designClassName: "",
  onCreateSuccess: (data, context) => {},
  onEditSuccess: (data, context) => {},
};

<script src="https://unpkg.com/@printcart/shopify-integration/dist/main.js"></script>;
```

### `designBtnText`

- Type: string

Change the Start Design button text

### `editBtnText`

- Type: string

Change the Edit Design button text

### `onCreateSuccess`

- Type: (data) => void

A function run when the design file finish uploaded.

### `onEditSuccess`

- Type: (data) => void

A function run when the design file finish editted.

**Example**

```js
window.PrintcartDesignerShopifyOptions = {
  designBtnText: "Custom Start Design Text",
  editBtnText: "Custom Edit Design Text",
  onCreateSuccess: (data) => console.log(data),
  onEditSuccess: (data) => console.log(data),
};

<script src="https://unpkg.com/@printcart/shopify-integration-sdk/dist/main.js"></script>;
```

<a href="https://printcart.com">
<img src="https://www.printcart.com/_next/static/image/src/common/assets/image/appModern/printcart-logo.db99b3d8b92bca6ff946c0869b114589.png" alt="Printcart" width="200px" />
</a>
