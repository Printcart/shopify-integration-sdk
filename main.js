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

    var getProductPromise = this.getShopifyProduct();

    if (getProductPromise) {
      getProductPromise
        .then((shopifyProduct) => {
          if (shopifyProduct) {
            const variantId = shopifyProduct.variants[0].id;

            this.getPrintcartProductByShopifyId(variantId)
              .then((res) => {
                var printcartProductId = res.data.id;

                this.addSdkToPage(printcartProductId);

                this.registerMessageEvent(shopifyProduct);
              })
              .catch((err) => {
                console.warn(err.message);
              });
          }
        })
        .catch((err) => console.log(err));
    }
  },

  registerMessageEvent: function (product) {
    window.addEventListener("message", (event) => {
      if (
        event.origin === this.customizerUrl &&
        event.data.message === "finishProcess"
      ) {
        var designs = event.data.data.data;

        var ids = designs.map((design) => design.id);

        var shopifyProductId = designs[0].product.integration_product_id;

        var body = {
          items: [
            {
              id: shopifyProductId,
              quantity: 1,
              properties: {
                _pcDesignIds: ids,
              },
            },
          ],
        };

        var root = window.Shopify.routes.root;

        console.log(root);

        fetch(root + "cart/add.js", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })
          .then((res) => {
            if (res.ok) {
              //TODO: if res is not ok => postMessage to design tool for error promt
              var wrapper = document.getElementById(
                "pcdesigntool-iframe-wrapper"
              );

              wrapper.style.opacity = 0;
              wrapper.style.visibility = "hidden";

              location.reload();
            }
          })
          .catch((err) => console.log(err));
      }
    });

    return;
  },

  getShopifyProduct: function () {
    var url = window.location.href;
    var urlArr = url.split("/");
    var handle = urlArr[urlArr.length - 1].split("?")[0];

    if (handle === "") return;

    var productJsonUrl = "/products/" + handle + ".js";

    return fetch(productJsonUrl, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());
  },

  // getProductJsonObject: function () {
  //   var url = window.location.href;
  //   var urlArr = url.split("/");
  //   var handle = urlArr[urlArr.length - 1];
  //   var productJsonUrl = "/products/" + handle + ".js";

  //   fetch(productJsonUrl, {
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //   })
  //     .then((res) => {
  //       return res.json();
  //     })
  //     .then((data) => {
  //       return data;
  //     })
  //     .catch((err) => console.log(err));
  // },

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
    // var authStr = "Bearer " + this.token;

    return fetch(url, {
      headers: {
        // Authorization: authStr,
        "X-PrintCart-Unauth-Token": this.token,
      },
    }).then((res) => res.json());
  },
};

shopifyIntegration.init();

window["PrintcartShopifySDK"] = shopifyIntegration;