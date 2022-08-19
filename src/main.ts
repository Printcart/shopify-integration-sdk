//@ts-ignore
import PrintcartDesigner from "@printcart/design-tool-sdk";
import "./main.css";

// TODO: on error events
interface IOptions {
  buttonId?: string;
  designBtnText?: string;
  editBtnText?: string;
  onCreateSuccess?: (data: any) => void;
  onEditSuccess?: (data: any) => void;
}

class PrintcartDesignerShopify {
  #apiUrl: string;
  token: string | null;
  productId: string | null;
  options?: IOptions;
  #designerUrl: string;
  #designerInstance: any;

  constructor() {
    this.token = this.#getUnauthToken();
    this.productId = null;

    // @ts-ignore
    this.options = window.PrintcartDesignerShopifyOptions;

    this.#apiUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL
      : "https://api.printcart.com/v1/integration/shopify/products";

    this.#designerUrl = import.meta.env.VITE_CUSTOMIZER_URL
      ? import.meta.env.VITE_CUSTOMIZER_URL
      : "https://customizer.printcart.com";

    this.#createDesignBtn();

    this.#getPrintcartProduct().then((res) => {
      this.productId = res.data.id;

      this.#designerInstance = new PrintcartDesigner({
        token: this.token,
        productId: this.productId,
        options: {
          designerUrl: this.#designerUrl,
        },
      });

      this.#registerDesignerEvents();

      const btn = document.querySelector("button#printcart-designer_btn");

      if (btn && btn instanceof HTMLButtonElement) {
        btn.disabled = false;

        btn.onclick = () => {
          this.#designerInstance.render();
        };
      }
    });
  }

  #registerDesignerEvents() {
    const self = this;

    this.#designerInstance.on("upload-success", (data: any) => {
      console.log(data);

      // Add hidden input for cart line item
      const ids = data.map((design: any) => design.id);

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "properties[_pcDesignIds]";
      input.className = "printcart-designer_input";
      input.value = ids.join();

      const productForms = document.querySelectorAll(
        'form[action="/cart/add"]'
      );
      const form = productForms[productForms.length - 1];

      if (!form || !form.parentNode) {
        throw new Error("Can't find form element");
      }

      form.appendChild(input);

      // Show design image list on product page
      const imageWrap = document.createElement("div");

      imageWrap.id = "printcart-designer_image-wrap";

      const iframe = document.querySelector("iframe#pc-designer-iframe");

      if (!iframe || !(iframe instanceof HTMLIFrameElement)) {
        throw new Error("Can't find Iframe Element");
      }

      data.forEach((design: any) => {
        const button = document.createElement("button");
        button.className = "printcart-designer_edit-button";
        button.setAttribute("data-printcart-design-id", design.id);

        button.onclick = () => {
          self.#designerInstance.editDesign(design.id);
        };

        const image = document.createElement("img");

        image.src = design.design_image.url;
        image.className = "printcart-designer_image";

        const span = document.createElement("span");
        //TODO: i18n
        span.innerHTML = this.options?.editBtnText
          ? this.options.editBtnText
          : "Edit";
        span.className = "printcart-designer_overlay";

        button.onmouseover = function () {
          //@ts-ignore
          this.style.background = "rgb(0 0 0 / 80%)";
          span.style.display = "block";
        };
        button.onmouseout = function () {
          //@ts-ignore
          this.style.background = "transparent";
          span.style.display = "none";
        };

        button.appendChild(image);
        button.appendChild(span);
        imageWrap.appendChild(button);
      });

      const wrap = document.querySelector("div#printcart-designer_wrap");

      wrap?.appendChild(imageWrap);

      const callback = this.options?.onCreateSuccess;

      if (callback) callback(data);
    });

    this.#designerInstance.on("edit-success", (data: any) => {
      const img = document.querySelector(
        `[data-printcart-design-id="${data.id}"] img`
      );

      if (!img || !(img instanceof HTMLImageElement)) {
        throw new Error("Can't find image element");
      }

      img.src = data.design_image.url;

      const callback = this.options?.onEditSuccess;

      if (callback) callback(data);
    });
  }

  #getUnauthToken() {
    const src = this.#getScriptSrc();

    const url = new URL(src);

    const params = new URLSearchParams(url.search);

    const token = params.get("shopT");

    return token;
  }

  #getScriptSrc() {
    const isDev = import.meta.env.MODE === "development";

    const src = isDev
      ? import.meta.url
      : (document.currentScript as HTMLScriptElement).src;

    return src;
  }

  async #getPrintcartProduct() {
    const url = window.location.href;
    const urlArr = url.split("/");
    const handle = urlArr[urlArr.length - 1].split("?")[0];

    // Not in product page
    if (handle === "") return null;

    const shopifyApiUrl = "/products/" + handle + ".js";

    try {
      const shopifyPromise = await fetch(shopifyApiUrl, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      const shopifyProduct = await shopifyPromise.json();

      if (!shopifyPromise.ok) {
        throw new Error(
          "Something wrong with Shopify API. Please try again later"
        );
      }

      const variantId = shopifyProduct.variants[0].id;

      if (!variantId) {
        throw new Error("Can not find product variant ID");
      }

      const printcartApiUrl = `${this.#apiUrl}/${variantId}`;

      const token = this.token;

      if (!token) {
        throw new Error("Missing Printcart Unauth Token");
      }

      const printcartPromise = await fetch(printcartApiUrl, {
        headers: {
          "X-PrintCart-Unauth-Token": token,
        },
      });

      const product = await printcartPromise.json();

      return product;
    } catch (error) {
      //@ts-ignore
      console.error(
        "There has been a problem with your fetch operation:",
        error
      );
    }
  }

  #createDesignBtn() {
    const cartForm = document.querySelector('form[action="/cart/add"]');

    if (!cartForm || !cartForm.parentNode) {
      return;
    }

    const wrap = document.createElement("div");
    wrap.id = "printcart-designer_wrap";

    const button = document.createElement("button");
    button.id = "printcart-designer_btn";
    button.className = "button";
    button.innerHTML = this.options?.designBtnText
      ? this.options.designBtnText
      : "Start Design";
    button.disabled = true;

    wrap.appendChild(button);

    cartForm.parentNode.insertBefore(wrap, cartForm);
  }
}

new PrintcartDesignerShopify();
