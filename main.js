(function () {
  var shopifyIntegration = {
    // sdkUrl:
    //   "https://d1jkuyr6ycnsww.cloudfront.net/design-tool/1.0.0/main.js",

    // apiUrl: "https://api.printcart.com/v1/integration/shopify/products/",

    sdkUrl: __SDK_URL__,

    apiUrl: __API_URL__,

    token: "",

    init: function () {
      this.token = this.getUnauthToken();

      var shopifyProductID = this.getShopifyProductId();

      // this.getPrintcartProductByShopifyId(productID);

      this.getPrintcartProductByShopifyId(shopifyProductID)
        .then((res) => {
          var printcartProductId = res.data.id;

          this.addSdkToPage(printcartProductId);
        })
        .catch((err) => console.warn(err.message));
    },

    addSdkToPage: function (productId) {
      if (!productId) {
        throw new Error("Missing Printcart Product ID");
      }

      var script, scriptContent;
      scriptContent = document.createElement("script");
      scriptContent.type = "text/javascript";
      scriptContent.async = true;
      scriptContent.id = "printcart-design-tool-sdk";
      scriptContent.setAttribute("data-unauthToken", this.token);
      scriptContent.setAttribute("data-productId", productId);
      scriptContent.src = this.sdkUrl;
      script = document.getElementsByTagName("script")[0];
      return script.parentNode.insertBefore(scriptContent, script);
    },

    getUnauthToken: function () {
      var token = null;

      var urlSearchParams = new URLSearchParams(
        document.currentScript.src.split("?")[1]
      );
      var params = Object.fromEntries(urlSearchParams.entries());

      if (params.shopT) {
        token = params.shopT;
      }

      return token;
    },

    getShopifyProductId: function () {
      var jsonElList = Array.from(document.querySelectorAll("script"));
      var productJsonEl = jsonElList.find(
        (jsonEl) => jsonEl.id && jsonEl.id.startsWith("ProductJson-")
      );

      // console.log(jsonElList)
      if (productJsonEl) {
        productId = JSON.parse(productJsonEl.innerHTML).id;
      }

      return productId;
    },

    getPrintcartProductByShopifyId: function (shopifyId) {
      if (!shopifyId) {
        throw new Error("Missing Shopify ID");
      }

      var url = this.apiUrl + shopifyId;
      var authStr = "Bearer " + this.token;

      // TODO: Add fetch polyfill
      return fetch(url, {
        headers: {
          Authorization: authStr,
        },
      }).then((res) => res.json());
    },
  };

  shopifyIntegration.init();

  window["PrintcartShopifySDK"] = shopifyIntegration;
})();
