//@ts-ignore
import PrintcartDesigner from "@printcart/design-tool-sdk";
//@ts-ignore
import PrintcartUploader from "@printcart/uploader-sdk";
import "./main.css";

// TODO: on error events
interface IOptions {
  buttonId?: string;
  designBtnText?: string;
  designClassName?: string;
  editBtnText?: string;
  removeUploaderBtnText?: string;
  onUploadSuccess?: (data: [DataWrap] | [Data], ctx: any) => void;
  onDesignCreateSuccess?: (data: [DataWrap] | [Data], ctx: any) => void;
  onDesignEditSuccess?: (data: Data, ctx: any) => void;
  designerOptions: {};
}

interface ILocales {
  [key: string]: {
    [key: string]: string;
  };
}

type DataWrap = {
  data: Data;
};

type Data = {
  id: string;
  design_image: {
    url?: string;
  };
  preview_image: {
    url?: string;
  };
};

type StoreDetail = {
  data: {
    language: string;
  };
};

class PrintcartDesignerShopify {
  #apiUrl: string;
  token: string | null;
  productId: string | null;
  options?: IOptions;
  #designerUrl: string;
  #designerInstance: any;
  #uploaderInstance: any;
  #productForm: HTMLFormElement | null;
  #cartForm: HTMLFormElement | null;
  locales: ILocales;

  constructor() {
    this.token = this.#getUnauthToken();
    this.productId = null;

    // @ts-ignore
    this.options = window.PrintcartDesignerShopifyOptions;

    this.#apiUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL
      : "https://api.printcart.com/v1/";

    this.#designerUrl = import.meta.env.VITE_CUSTOMIZER_URL
      ? import.meta.env.VITE_CUSTOMIZER_URL
      : "https://customizer.printcart.com";

    this.#productForm = document.querySelector('form[action$="/cart/add"]');
    this.#cartForm = document.querySelector(
      'form[action$="/cart/add"][data-type="add-to-cart-form"]'
    );
    this.locales = {
      // EN
      en: {
        start_design: "Start Design",
        pc_select_header: "Choose a way to design this product",
        upload_a_full_design: "Upload a full design",
        upload_design_file: "Upload Design file",
        have_a_complete_design: "Have a complete design",
        have_your_own_design: "Have your own design",
        design_here_online: "Design here online",
        already_have_a_design: "Already have your concept",
        customize_every_details: "Customize every details",
      },
      // ES
      es: {
        start_design: "Crear Diseño",
        pc_select_header: "Elija una forma de diseñar este producto",
        upload_a_full_design: "Sube tu diseño",
        upload_design_file: "Subir archivo de diseño",
        have_a_complete_design: "Tienes el diseño listo",
        have_your_own_design: "Tienes tu propio diseñador",
        design_here_online: "Diseña en linea aquí",
        already_have_a_design: "Ya tienes tu idea lista",
        customize_every_details: " Personaliza todos los detalles",
      },
    };

    if (!this.#productForm) {
      throw new Error(
        "This script can only be used inside a Shopify Product Page."
      );
    }

    this.#addStyle();
    this.#openSelectModal();
    this.#registerCloseModal();
    this.#modalTrap();

    let variantId = null;

    const variantSelect = this.#productForm.querySelector(
      'form[action$="/cart/add"] input[name="id"]'
    );

    variantId = variantSelect?.value;

    variantSelect?.addEventListener("change", () => {
      variantId = variantSelect.value;

      this.#initializeProductTools(variantId);
    });

    // Language
    this.#language();

    this.#initializeProductTools(variantId);
  }

  async #initializeProductTools(variantId: string | null) {
    let _variantId = variantId;

    if (!variantId) {
      const _variantId = window?.ShopifyAnalytics?.meta?.shopifyMetaData;

      console.log("Printcart", _variantId);
    }

    console.log("Printcart", _variantId);

    if (!_variantId) {
      throw new Error("Can not find product variant ID");
    }

    this.#getPrintcartProduct(_variantId).then((res) => {
      this.productId = res.data.id;

      const isDesignEnabled = res.data.enable_design;
      const isUploadEnabled = res.data.enable_upload;

      if (isDesignEnabled) {
        this.#designerInstance = new PrintcartDesigner({
          token: this.token,
          productId: this.productId,
          options: {
            ...this.options?.designerOptions,
            designerUrl: this.#designerUrl,
          },
        });

        this.#registerDesignerEvents();
      }

      if (isUploadEnabled) {
        this.#uploaderInstance = new PrintcartUploader({
          token: this.token,
          productId: this.productId,
        });

        this.#registerUploaderEvents();
      }

      if (isUploadEnabled || isDesignEnabled) {
        this.#createBtn();
      }
    });
  }

  #openModal() {
    const modal = document.getElementById("pc-select_wrap");

    if (modal) {
      modal.style.display = "flex";
      document.body.classList.add("pc-overflow");
    }

    const closeBtn = modal?.querySelector("#pc-select_close-btn");
    if (closeBtn && closeBtn instanceof HTMLButtonElement) closeBtn.focus();
  }

  #closeModal() {
    const modal = document.getElementById("pc-select_wrap");

    if (modal) {
      modal.style.display = "none";
    }

    document.body.classList.remove("pc-overflow");
  }

  #registerCloseModal() {
    const closeModalBtn = document.getElementById("pc-select_close-btn");
    const backdropCloseModal = document.getElementById("pc-content-overlay");

    const handleClose = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.#closeModal();
      }
    };

    window.addEventListener("keydown", handleClose);
    closeModalBtn?.addEventListener("click", () => this.#closeModal());
    backdropCloseModal?.addEventListener("click", () => {
      const iframeWrap = document.getElementById("pc-designer-iframe-wrapper");
      if (iframeWrap?.style.visibility !== "visible") {
        this.#closeModal();
      }
    });
  }

  #openSelectModal() {
    const uploadImgSrc = "https://files.printcart.com/common/upload.svg";
    const designImgSrc = "https://files.printcart.com/common/design.svg";

    const inner = `
      <button aria-label="Close" id="pc-select_close-btn"><span data-modal-x></span></button>
      <div class="pc-select-wrap" id="pc-content-overlay">
        <div class="pc-select-inner">
          <div id="pc-select_header" data-i18n="pc_select_header"></div>
          <div id="pc-select_container">
            <button class="pc-select_btn" id="pc-select_btn_upload">
              <div aria-hidden="true" class="pc-select_btn_wrap">
                <div class="pc-select_btn_img">
                  <div class="pc-select_btn_img_inner">
                    <img src="${uploadImgSrc}" alt="Printcart Uploader" />
                  </div>
                </div>
                <div class="pc-select_btn_content">
                  <div class="pc-select_btn_content_inner">
                    <h2 class="pc-title" data-i18n="upload_a_full_design"></h2>
                    <ul>
                      <li data-i18n="have_a_complete_design"></li>
                      <li data-i18n="have_your_own_design"></li>
                    </ul>
                  </div>
                </div>
              </div>
              <div class="visually-hidden" data-i18n="upload_design_file"></div>
            </button>
            <button class="pc-select_btn" id="pc-select_btn_design">
              <div aria-hidden="true" class="pc-select_btn_wrap">
                <div class="pc-select_btn_img">
                  <div class="pc-select_btn_img_inner">
                    <img src="${designImgSrc}" alt="Printcart Designer" />
                  </div>
                </div>
                <div class="pc-select_btn_content">
                  <div class="pc-select_btn_content_inner">
                    <h2 class="pc-title" data-i18n="design_here_online"></h2>
                    <ul>
                      <li data-i18n="already_have_a_design"></li>
                      <li data-i18n="customize_every_details"></li>
                    </ul>
                  </div>
                </div>
              </div>
              <div class="visually-hidden" data-i18n="upload_design_file"></div>
            </button>
          </div>
        </div>
      </div>
    `;

    const wrap = document.createElement("div");
    wrap.id = "pc-select_wrap";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("tabIndex", "-1");
    wrap.innerHTML = inner;

    document.body.appendChild(wrap);

    const design = () => {
      if (this.#designerInstance) {
        this.#closeModal();

        this.#designerInstance.render();
        document.body.classList.add("pc-overflow");
      }
    };

    const upload = () => {
      if (this.#uploaderInstance) {
        this.#closeModal();

        this.#uploaderInstance.open();
        document.body.classList.add("pc-overflow");
      }
    };

    const uploadBtn = document.getElementById("pc-select_btn_upload");
    const designBtn = document.getElementById("pc-select_btn_design");

    if (uploadBtn) uploadBtn?.addEventListener("click", upload);
    if (designBtn) designBtn?.addEventListener("click", design);
  }

  #modalTrap() {
    const modal = document.getElementById("pc-select_wrap");

    const focusableEls = modal?.querySelectorAll("button");

    const firstFocusableEl = focusableEls && focusableEls[0];
    const lastFocusableEl =
      focusableEls && focusableEls[focusableEls.length - 1];

    const handleModalTrap = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (lastFocusableEl && document.activeElement === firstFocusableEl) {
            e.preventDefault();
            lastFocusableEl.focus();
          }
        } else {
          if (firstFocusableEl && document.activeElement === lastFocusableEl) {
            e.preventDefault();
            firstFocusableEl.focus();
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

  #handleUploadSuccess(data: [DataWrap]) {
    const ids = data.map((design) => design.data.id);

    let input = <HTMLInputElement>(
      document.querySelector('input[name="properties[_pcDesignIds]"]')
    );

    if (input) {
      input.value += `,${ids.join()}`;
    } else {
      input = <HTMLInputElement>document.createElement("input");
      input.type = "hidden";
      input.name = "properties[_pcDesignIds]";
      input.className = "pc-designer_input";
      input.value = ids.join();

      if (this.#cartForm) {
        this.#cartForm.appendChild(input);
      } else {
        this.#productForm?.appendChild(input);
      }
    }

    // Show design image list on product page
    const previewWrap =
      document.querySelector(".pc-preview-wrap") ||
      document.createElement("div");

    previewWrap.className = "pc-preview-wrap";

    data.forEach((design) => {
      if (!design.data.design_image.url) return;

      const preview = document.createElement("div");
      preview.className = "pc-preview";
      preview.setAttribute("data-pc-design-id", design.data.id);

      const btn = document.createElement("button");
      btn.className = "pc-btn pc-danger-btn";
      btn.innerHTML = this.options?.removeUploaderBtnText
        ? this.options.removeUploaderBtnText
        : "Remove";
      btn.onclick = (e) => {
        e.preventDefault();
        const newIds = input.value
          .split(",")
          .filter((id) => id !== design.data.id);

        input.value = newIds.join();

        preview.remove();
      };

      const image = document.createElement("img");
      image.src = design.data.design_image.url;
      image.className = "pc-uploader-image";

      const overlay = document.createElement("div");
      overlay.className = "pc-preview-overlay";

      overlay.appendChild(btn);
      preview.appendChild(overlay);
      preview.appendChild(image);
      previewWrap.appendChild(preview);
    });

    const wrap = document.querySelector("div#pc-designer_wrap");

    if (!document.querySelector(".princart-preview-heading")) {
      const heading = document.createElement("h5");
      heading.className = "princart-preview-heading";
      heading.innerHTML = "Your artworks";

      wrap?.appendChild(heading);
    }

    wrap?.appendChild(previewWrap);

    const callback = this.options?.onUploadSuccess;

    if (callback) callback(data, this.#uploaderInstance);
  }

  #handleDesignSuccess(data: [Data]) {
    const self = this;
    const ids = data.map((design) => design.id);

    let input = <HTMLInputElement>(
      document.querySelector('input[name="properties[_pcDesignIds]"]')
    );

    if (input) {
      input.value = ids.join();
    } else {
      input = <HTMLInputElement>document.createElement("input");
      input.type = "hidden";
      input.name = "properties[_pcDesignIds]";
      input.className = "pc-designer_input";
      input.value = ids.join();

      if (this.#cartForm) {
        this.#cartForm.appendChild(input);
      } else {
        this.#productForm?.appendChild(input);
      }
    }

    const previewWrap =
      document.querySelector(".pc-preview-wrap") ||
      document.createElement("div");

    previewWrap.className = "pc-preview-wrap";

    data.forEach((design) => {
      if (!design.design_image.url) return;

      const preview = document.createElement("div");
      preview.className = "pc-preview";
      preview.setAttribute("data-pc-design-id", design.id);

      const editBtn = document.createElement("button");
      editBtn.className = "pc-btn pc-primary-btn";
      editBtn.innerHTML = "Edit";
      editBtn.onclick = (e) => {
        e.preventDefault();
        self.#designerInstance.editDesign(design.id);
      };

      const removeBtn = document.createElement("button");
      removeBtn.className = "pc-btn pc-danger-btn";
      removeBtn.innerHTML = "Remove";
      removeBtn.onclick = (e) => {
        e.preventDefault();
        const newIds = input.value.split(",").filter((id) => id !== design.id);

        input.value = newIds.join();

        preview.remove();
      };

      const image = document.createElement("img");
      image.src = design.preview_image?.url || design.design_image.url;
      image.className = "pc-uploader-image";

      const overlay = document.createElement("div");
      overlay.className = "pc-preview-overlay";

      overlay.appendChild(editBtn);
      overlay.appendChild(removeBtn);
      preview.appendChild(overlay);
      preview.appendChild(image);
      previewWrap.appendChild(preview);
    });

    const wrap = document.querySelector("div#pc-designer_wrap");

    wrap?.appendChild(previewWrap);

    const callback = this.options?.onDesignCreateSuccess;

    if (callback) callback(data, this.#designerInstance);
  }

  #registerUploaderEvents() {
    if (this.#uploaderInstance) {
      this.#uploaderInstance.on("upload-success", (data: [DataWrap]) => {
        this.#handleUploadSuccess(data);
        this.#uploaderInstance.close();
      });
    }
  }

  #registerDesignerEvents() {
    if (this.#designerInstance) {
      this.#designerInstance.on("upload-success", (data: [Data]) => {
        this.#handleDesignSuccess(data);
        this.#designerInstance.close();
      });

      this.#designerInstance.on("closed", () => {
        document.body.classList.remove("pc-overflow");
      });

      this.#designerInstance.on("edit-success", (data: Data) => {
        if (!data.design_image.url) return;

        const img = document.querySelector(
          `[data-pc-design-id="${data.id}"] img`
        );

        if (!img || !(img instanceof HTMLImageElement)) {
          throw new Error("Can't find image element");
        }

        img.src = data.design_image.url;

        const callback = this.options?.onDesignEditSuccess;

        this.#designerInstance.close();

        if (callback) callback(data, this.#designerInstance);
      });
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

  async #getPrintcartProduct(variantId: string) {
    try {
      const printcartApiUrl = `${
        this.#apiUrl
      }integration/shopify/products/${variantId}`;

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

  async #getStoreDetail() {
    try {
      const printcartApiUrl = `${this.#apiUrl}stores/store-details`;

      const token = this.token;
      if (!token) {
        throw new Error("Missing Printcart Unauth Token");
      }

      const printcartPromise = await fetch(printcartApiUrl, {
        headers: {
          "X-PrintCart-Unauth-Token": token,
        },
      });

      const storeDetail: StoreDetail = await printcartPromise.json();

      return storeDetail;
    } catch (error) {
      //@ts-ignore
      console.error(
        "There has been a problem with your fetch operation:",
        error
      );
    }
  }

  #createBtn() {
    const cartForm = this.#cartForm ?? this.#productForm;

    if (!cartForm?.parentNode) {
      console.log("Can not find cart form");

      return;
    }

    let button = document.querySelector("div#pc-designer_wrap button#pc-btn");

    if (button === null) {
      const wrap = document.createElement("div");
      wrap.id = "pc-designer_wrap";

      button = document.createElement("button");
      button.id = "pc-btn";
      button.className = this.options?.designClassName
        ? this.options?.designClassName
        : "button";
      const lang = localStorage.getItem("pc_lang") || "";
      const titleStartDesign = this.locales[lang].start_design;

      button.innerHTML = this.options?.designBtnText
        ? this.options.designBtnText
        : titleStartDesign;
      wrap.appendChild(button);

      const btnSubmitElement = cartForm?.querySelector('button[type="submit"]');

      if (btnSubmitElement) {
        btnSubmitElement?.insertAdjacentElement("beforebegin", wrap);
      } else {
        cartForm?.insertAdjacentElement("afterend", wrap);
      }
    }

    if (button && button instanceof HTMLButtonElement)
      button.onclick = (e) => {
        e.preventDefault();
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
  }

  async #language() {
    let defaultLanguage: any = "en";
    await this.#getStoreDetail()
      .then((res: any) => {
        if (res.data.language === "en" || res.data.language === "es") {
          localStorage.setItem("pc_lang", res.data.language);
          defaultLanguage = res.data.language;
          return;
        }

        localStorage.setItem("pc_lang", "en");
        defaultLanguage = "en";
        return;
      })
      .catch((error) => {
        console.error(error);
      });

    const elements: NodeListOf<HTMLElement> =
      document.querySelectorAll("[data-i18n]");

    const json = this.locales[defaultLanguage];

    elements.forEach((element: HTMLElement) => {
      const key: string | null = element.getAttribute("data-i18n");
      let text: string | null = key
        ? key
            .split(".")
            .reduce((obj: any, i: string) => (obj ? obj[i] : null), json)
        : null;

      const variables: RegExpMatchArray | null = text
        ? text.match(/{(.*?)}/g)
        : null;
      if (variables) {
        variables.forEach((variable: string) => {
          Object.entries(element.dataset).filter(([key, value]) => {
            if (`{${key}}` === variable) {
              try {
                text = text
                  ? text.replace(
                      `${variable}`,
                      new Function(`return (${value})`)()
                    )
                  : null;
              } catch (error) {
                const nValue = value || "";
                text = text ? text.replace(`${variable}`, nValue) : null;
              }
            }
          });
        });
      }

      if (text) {
        element.innerHTML = text;
      }
    });

    const htmlElement: HTMLElement | null = document.querySelector("html");
    if (htmlElement) {
      htmlElement.setAttribute("lang", defaultLanguage);
    }
  }
}

const prepare = async () => {
  if (import.meta.env.DEV) {
    // const { worker } = require("./mocks/browser");
    //@ts-ignore
    const { worker } = await import("../mocks/browser");
    worker.start();
  }
};

prepare().then(() => new PrintcartDesignerShopify());

// new PrintcartDesignerShopify();
