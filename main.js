(function () {
  var shopifyIntegration = {
    // sdkUrl:
    //   "https://d1jkuyr6ycnsww.cloudfront.net/design-tool/1.0.0/main.js",

    // apiUrl: "https://api.printcart.com/v1/integration/shopify/products/",

    customizerSdkUrl: __SDK_URL__,

    apiUrl: __API_URL__,

    token: "",

    customizerUrl: __CUSTOMIZER_URL__,

    init: function () {
      this.token = this.getUnauthToken();

      var shopifyProduct = this.getShopifyProduct();

      if (shopifyProduct) {
        const variantId = shopifyProduct.variants[0].id;

        this.getPrintcartProductByShopifyId(variantId)
          .then((res) => {
            var printcartProductId = res.data.id;

            this.addSdkToPage(printcartProductId);

            this.registerMessageEvent(shopifyProduct);
          })
          .catch((err) => console.warn(err.message));
      }
    },

    registerMessageEvent: function (product) {
      window.addEventListener("message", (event) => {
        if (event.origin === this.customizerUrl) {
          const body = {
            items: [
              {
                id: product.variants[0].id,
                quantity: 1,
                properties: {
                  _pcDesignUrl: "<a href='https://google.com'>Test</a>",
                  _pcDesignId: "12637123713",
                },
              },
            ],
          };

          fetch("/cart/add.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          })
            .then((res) => {
              console.log(res);
            })
            .catch((err) => console.log(err));
        }
      });

      return;
    },

    getShopifyProduct: function () {
      var product;

      var jsonElList = Array.from(document.querySelectorAll("script"));
      var productJsonEl = jsonElList.find(
        (jsonEl) => jsonEl.id && jsonEl.id.startsWith("ProductJson-")
      );

      if (productJsonEl) {
        product = JSON.parse(productJsonEl.innerHTML);
      } else {
        this.getProductJsonObject()
          .then((res) => {
            product = res;
          })
          .catch((err) => console.log(err));
      }

      return product;
    },

    getProductJsonObject: function () {
      var url = window.location.href;
      var urlArr = url.split("/");
      var handle = urlArr[urlArr.length - 1];
      var productJsonUrl = "/products/" + handle + ".js";

      return fetch(productJsonUrl, {
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
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
      scriptContent.src = this.customizerSdkUrl;
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
