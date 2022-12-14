//@ts-ignore
import PrintcartDesigner from "@printcart/design-tool-sdk";
//@ts-ignore
import PrintcartUploader from "@printcart/uploader-sdk";
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
  #uploaderInstance: any;

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

    this.#addStyle();
    this.#createBtn();
    this.#openSelectModal();
    this.#registerCloseModal();
    this.#modalTrap();

    this.#getPrintcartProduct().then((res) => {
      this.productId = res.data.id;

      const btn = document.querySelector("button#printcart-btn");

      const isDesignEnabled = res.data.enable_design;
      const isUploadEnabled = res.data.enable_upload;

      if (isDesignEnabled) {
        this.#designerInstance = new PrintcartDesigner({
          token: this.token,
          productId: this.productId,
          options: {
            designerUrl: this.#designerUrl,
          },
        });

        this.#registerDesignerEvents();

        if (btn && btn instanceof HTMLButtonElement) {
          btn.disabled = false;
        }
      }

      if (isUploadEnabled) {
        this.#uploaderInstance = new PrintcartUploader({
          token: this.token,
          sideId: "732b92ee-d9c6-4f45-8d62-a83f62566aa7",
          uploaderUrl: "http://localhost:3003/",
        });

        this.#registerDesignerEvents();

        if (btn && btn instanceof HTMLButtonElement) {
          btn.disabled = false;
        }
      }

      const handleClick = () => {
        if (this.#designerInstance && !this.#uploaderInstance) {
          this.#designerInstance.render();
        }

        if (!this.#designerInstance && this.#uploaderInstance) {
          this.#uploaderInstance.open();
        }

        if (this.#designerInstance && this.#uploaderInstance) {
          this.#openModal();
        }
      };

      if (btn && btn instanceof HTMLButtonElement) {
        btn.onclick = handleClick;
      }
    });
  }

  #openModal() {
    const modal = document.getElementById("printcart-select_wrap");

    if (modal) {
      modal.style.display = "flex";
      document.body.style.overflow = "hidden";
    }

    const closeBtn = modal?.querySelector("#printcart-select_close-btn");
    if (closeBtn && closeBtn instanceof HTMLButtonElement) closeBtn.focus();
  }

  #closeModal() {
    const modal = document.getElementById("printcart-select_wrap");

    if (modal) {
      modal.style.display = "none";
      document.body.style.overflow = "scroll";
    }
  }

  #registerCloseModal() {
    const closeModalBtn = document.getElementById("printcart-select_close-btn");

    const handleClose = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.#closeModal();
      }
    };

    window.addEventListener("keydown", handleClose);
    closeModalBtn?.addEventListener("click", () => this.#closeModal());
  }

  #openSelectModal() {
    const uploadImgSrc = "https://files.printcart.com/common/upload.svg";
    const designImgSrc = "https://files.printcart.com/common/design.svg";

    const inner = `
      <button aria-label="Close" id="printcart-select_close-btn"><span data-modal-x></span></button>
      <div id="printcart-select_header">Choose a way to design this product</div>
      <div id="printcart-select_container">
        <button class="printcart-select_btn" id="printcart-select_btn_upload">
          <div aria-hidden="true" class="printcart-select_btn_wrap">
            <div class="printcart-select_btn_img">
              <img src="${uploadImgSrc}" alt="Printcart Uploader" />
            </div>
            <div class="printcart-select_btn_content">
              <h2>Upload a full design</h2>
              <ul>
                <li>Have a complete design</li>
                <li>Have your own designer</li>
              </ul>
            </div>
          </div>
          <div class="visually-hidden">Upload Design file</div>
        </button>
        <button class="printcart-select_btn" id="printcart-select_btn_design">
          <div aria-hidden="true" class="printcart-select_btn_wrap">
            <div class="printcart-select_btn_img">
              <img src="${designImgSrc}" alt="Printcart Designer" />
            </div>
            <div class="printcart-select_btn_content">
              <h2>Design here online</h2>
              <ul>
                <li>Already have your concept</li>
                <li>Customize every details</li>
              </ul>
            </div>
          </div>
          <div class="visually-hidden">Upload Design file</div>
        </button>
      </div>
    `;

    const wrap = document.createElement("div");
    wrap.id = "printcart-select_wrap";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("tabIndex", "-1");
    wrap.innerHTML = inner;

    document.body.appendChild(wrap);

    const design = () => {
      if (this.#designerInstance) {
        this.#closeModal();

        this.#designerInstance.render();
      }
    };

    const upload = () => {
      if (this.#uploaderInstance) {
        this.#closeModal();

        this.#uploaderInstance.open();
      }
    };

    const uploadBtn = document.getElementById("printcart-select_btn_upload");
    const designBtn = document.getElementById("printcart-select_btn_design");

    if (uploadBtn) uploadBtn?.addEventListener("click", upload);
    if (designBtn) designBtn?.addEventListener("click", design);
  }

  #modalTrap() {
    const modal = document.getElementById("printcart-select_wrap");

    const focusableEls = modal?.querySelectorAll("button");

    const firstFocusableEl = focusableEls && focusableEls[0];
    const lastFocusableEl =
      focusableEls && focusableEls[focusableEls.length - 1];

    const handleModalTrap = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (lastFocusableEl && document.activeElement === firstFocusableEl) {
            lastFocusableEl.focus();
            e.preventDefault();
          }
        } else {
          if (firstFocusableEl && document.activeElement === lastFocusableEl) {
            firstFocusableEl.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleModalTrap);
  }

  #addStyle() {
    const sdkUrl = import.meta.env.VITE_SDK_URL
      ? import.meta.env.VITE_SDK_URL
      : "https://unpkg.com/@printcart/shopify-integration/dist";

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${sdkUrl}/style.css`;

    document.head.appendChild(link);
  }

  #registerDesignerEvents() {
    const self = this;

    if (this.#designerInstance) {
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
        console.log(data);

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

    if (this.#uploaderInstance) {
      this.#uploaderInstance.on("upload-success", (data: unknown) =>
        console.log('te')
      );
      this.#uploaderInstance.on("upload-error", (err: unknown) =>
        console.log(err)
      );
    }
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

  #createBtn() {
    const cartForm = document.querySelector('form[action="/cart/add"]');

    if (!cartForm || !cartForm.parentNode) {
      return;
    }

    const wrap = document.createElement("div");
    wrap.id = "printcart-designer_wrap";

    const button = document.createElement("button");
    button.id = "printcart-btn";
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
