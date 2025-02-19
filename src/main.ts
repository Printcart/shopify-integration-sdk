"use strict";

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

interface TPostQuotationRequest {
  name: string;
  product_id: string;
  email: string;
  phone: string;
  whatsapp: string;
  note: string;
  design_file: any;
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
  preview: {
    design?: {
      url?: string;
    };
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
  #quotationRequestInstance: boolean;
  #productForm: HTMLFormElement | null;
  #cartForm: HTMLFormElement | null;
  locales: ILocales;

  constructor() {
    this.token = this.#getUnauthToken();
    this.productId = null;
    this.#quotationRequestInstance = false;

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
        request_us_to_design: "Request Us to Design",
        share_your_idea: "Share your ideas in a brief",
        our_designers_do_st: "Our designers will craft a custom design for you",
        note_desc: "Brief of what you would like designing",
        file_desc: "Upload any reference images or design files",
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
        request_us_to_design: "Request Us to Design",
        share_your_idea: "Share your ideas in a brief",
        our_designers_do_st: "Our designers will craft a custom design for you",
        note_desc: "Brief of what you would like designing",
        file_desc: "Upload any reference images or design files",
      },
    };

    if (!this.#productForm) {
      throw new Error(
        "This script can only be used inside a Shopify Product Page."
      );
    }

    this.#addStyle();

    let variantId = null;

    let variantSelect = this.#productForm.querySelector(
      'form[action$="/cart/add"] [name="id"]'
    );

    if (!variantSelect) {
      variantSelect = document.querySelector(
        'form[action$="/cart/add"] [name="id"]'
      );
    }

    variantId = variantSelect?.value;

    variantSelect?.addEventListener("change", () => {
      variantId = variantSelect.value;

      this.#initializeProductTools(variantId);
    });

    this.#initializeProductTools(variantId);
  }

  #initializeProductTools(variantId: string | null) {
    if (!variantId) {
      const shopifyMetaData = window?.ShopifyAnalytics?.meta;
      variantId = shopifyMetaData?.selectedVariantId;
    }

    if (!variantId) {
      throw new Error("Can not find product variant ID");
    }

    this.#getPrintcartProduct(variantId).then((res) => {
      this.productId = res.data.id;

      const isDesignEnabled = res.data.enable_design;
      const isUploadEnabled = res.data.enable_upload;
      const isQuotationRequest = res.data.enable_request_quote;

      // Language
      this.#language();

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

      if (isQuotationRequest) {
        this.#quotationRequestInstance = true;
        this.#initializeQuoteRequest(res.data);
      }

      if (isUploadEnabled || isDesignEnabled || isQuotationRequest) {
        this.#createBtn();
      }

      this.#openSelectModal();
      this.#registerCloseModal();
      this.#modalTrap();
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
    const quoteImgSrc = "https://files.printcart.com/common/quote.svg";

    const buttonUploader = `<button class="pc-select_btn" id="pc-select_btn_upload">
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
    </button>`;
    const buttonDesigner = `<button class="pc-select_btn" id="pc-select_btn_design">
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
    </button>`;

    const buttonQuoteRequest = `<button class="pc-select_btn" id="pc-select_btn_quote_request">
      <div aria-hidden="true" class="pc-select_btn_wrap">
        <div class="pc-select_btn_img">
          <div class="pc-select_btn_img_inner">
            <img src="${quoteImgSrc}" alt="Printcart Quotation Request" />
          </div>
        </div>
        <div class="pc-select_btn_content">
          <div class="pc-select_btn_content_inner">
            <h2 class="pc-title" data-i18n="request_us_to_design"></h2>
            <ul>
              <li data-i18n="share_your_idea"></li>
              <li data-i18n="our_designers_do_st"></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="visually-hidden" data-i18n="upload_design_file"></div>
    </button>`;

    const inner = `
      <button aria-label="Close" id="pc-select_close-btn"><span data-modal-x></span></button>
      <div class="pc-select-wrap" id="pc-content-overlay">
        <div class="pc-select-inner">
          <div id="pc-select_header" data-i18n="pc_select_header"></div>
          <div id="pc-select_container">
            ${this.#designerInstance ? buttonDesigner : ""}
            ${this.#uploaderInstance ? buttonUploader : ""}
            ${this.#quotationRequestInstance ? buttonQuoteRequest : ""}
          </div>
        </div>
      </div>
    `;
    const containerWrap = document.getElementById('pc-select_wrap')
    if(containerWrap){
      containerWrap.remove()
    }

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

    const quoteRequest = () => {
      this.#quotationRequestOpen();
    };

    const uploadBtn = document.getElementById("pc-select_btn_upload");
    const designBtn = document.getElementById("pc-select_btn_design");
    const quoteBtn = document.getElementById("pc-select_btn_quote_request");

    if (uploadBtn) uploadBtn?.addEventListener("click", upload);
    if (designBtn) designBtn?.addEventListener("click", design);
    if (quoteBtn) quoteBtn?.addEventListener("click", quoteRequest);
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
    window.ShopifyAnalytics = window.ShopifyAnalytics || {};
    window.ShopifyAnalytics.meta = window.ShopifyAnalytics.meta || {};
    window.ShopifyAnalytics.meta.currency = 'USD';
    var meta = {"product":{"id":8933974311204,"gid":"gid:\/\/shopify\/Product\/8933974311204","vendor":"T-shirt Center","type":"","variants":[{"id":47593997599012,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Black \/ Small","public_title":"Black \/ Small","sku":null},{"id":47593997631780,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Black \/ Medium","public_title":"Black \/ Medium","sku":null},{"id":47593997664548,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Black \/ Large","public_title":"Black \/ Large","sku":null},{"id":47593997697316,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Black \/ Xlarge","public_title":"Black \/ Xlarge","sku":null},{"id":47593997730084,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Black \/ 2Xlarge","public_title":"Black \/ 2Xlarge","sku":null},{"id":47593997762852,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Black \/ 3Xlarge","public_title":"Black \/ 3Xlarge","sku":null},{"id":47593997795620,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - White \/ Small","public_title":"White \/ Small","sku":null},{"id":47593997828388,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - White \/ Medium","public_title":"White \/ Medium","sku":null},{"id":47593997861156,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - White \/ Large","public_title":"White \/ Large","sku":null},{"id":47593997893924,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - White \/ Xlarge","public_title":"White \/ Xlarge","sku":null},{"id":47593997926692,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - White \/ 2Xlarge","public_title":"White \/ 2Xlarge","sku":null},{"id":47593997959460,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - White \/ 3Xlarge","public_title":"White \/ 3Xlarge","sku":null},{"id":47593997992228,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Gray \/ Small","public_title":"Gray \/ Small","sku":null},{"id":47593998024996,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Gray \/ Medium","public_title":"Gray \/ Medium","sku":null},{"id":47593998057764,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Gray \/ Large","public_title":"Gray \/ Large","sku":null},{"id":47593998090532,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Gray \/ Xlarge","public_title":"Gray \/ Xlarge","sku":null},{"id":47593998123300,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Gray \/ 2Xlarge","public_title":"Gray \/ 2Xlarge","sku":null},{"id":47593998156068,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Gray \/ 3Xlarge","public_title":"Gray \/ 3Xlarge","sku":null},{"id":47593998188836,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Red \/ Small","public_title":"Red \/ Small","sku":null},{"id":47593998221604,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Red \/ Medium","public_title":"Red \/ Medium","sku":null},{"id":47593998254372,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Red \/ Large","public_title":"Red \/ Large","sku":null},{"id":47593998287140,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Red \/ Xlarge","public_title":"Red \/ Xlarge","sku":null},{"id":47593998319908,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Red \/ 2Xlarge","public_title":"Red \/ 2Xlarge","sku":null},{"id":47593998352676,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Red \/ 3Xlarge","public_title":"Red \/ 3Xlarge","sku":null},{"id":47598037958948,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Royal blue \/ Small","public_title":"Royal blue \/ Small","sku":null},{"id":47598037991716,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Royal blue \/ Medium","public_title":"Royal blue \/ Medium","sku":null},{"id":47598038024484,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Royal blue \/ Large","public_title":"Royal blue \/ Large","sku":null},{"id":47598038057252,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Royal blue \/ Xlarge","public_title":"Royal blue \/ Xlarge","sku":null},{"id":47598038090020,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Royal blue \/ 2Xlarge","public_title":"Royal blue \/ 2Xlarge","sku":null},{"id":47598038122788,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Royal blue \/ 3Xlarge","public_title":"Royal blue \/ 3Xlarge","sku":null},{"id":47593998582052,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety yellow \/ Small","public_title":"Safety yellow \/ Small","sku":null},{"id":47593998614820,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety yellow \/ Medium","public_title":"Safety yellow \/ Medium","sku":null},{"id":47593998647588,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety yellow \/ Large","public_title":"Safety yellow \/ Large","sku":null},{"id":47593998680356,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety yellow \/ Xlarge","public_title":"Safety yellow \/ Xlarge","sku":null},{"id":47593998713124,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety yellow \/ 2Xlarge","public_title":"Safety yellow \/ 2Xlarge","sku":null},{"id":47593998745892,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety yellow \/ 3Xlarge","public_title":"Safety yellow \/ 3Xlarge","sku":null},{"id":47598038155556,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Navy blue \/ Small","public_title":"Navy blue \/ Small","sku":null},{"id":47598038188324,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Navy blue \/ Medium","public_title":"Navy blue \/ Medium","sku":null},{"id":47598038221092,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Navy blue \/ Large","public_title":"Navy blue \/ Large","sku":null},{"id":47598038253860,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Navy blue \/ Xlarge","public_title":"Navy blue \/ Xlarge","sku":null},{"id":47598038286628,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Navy blue \/ 2Xlarge","public_title":"Navy blue \/ 2Xlarge","sku":null},{"id":47598038319396,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Navy blue \/ 3Xlarge","public_title":"Navy blue \/ 3Xlarge","sku":null},{"id":47593999171876,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety orange \/ Small","public_title":"Safety orange \/ Small","sku":null},{"id":47593999204644,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety orange \/ Medium","public_title":"Safety orange \/ Medium","sku":null},{"id":47593999237412,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety orange \/ Large","public_title":"Safety orange \/ Large","sku":null},{"id":47593999270180,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety orange \/ Xlarge","public_title":"Safety orange \/ Xlarge","sku":null},{"id":47593999302948,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety orange \/ 2Xlarge","public_title":"Safety orange \/ 2Xlarge","sku":null},{"id":47593999335716,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Safety orange \/ 3Xlarge","public_title":"Safety orange \/ 3Xlarge","sku":null},{"id":47598151434532,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Dark grey \/ Small","public_title":"Dark grey \/ Small","sku":null},{"id":47598151467300,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Dark grey \/ Medium","public_title":"Dark grey \/ Medium","sku":null},{"id":47598151500068,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Dark grey \/ Large","public_title":"Dark grey \/ Large","sku":null},{"id":47598151532836,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Dark grey \/ Xlarge","public_title":"Dark grey \/ Xlarge","sku":null},{"id":47598151565604,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Dark grey \/ 2Xlarge","public_title":"Dark grey \/ 2Xlarge","sku":null},{"id":47598151598372,"price":2000,"name":"Custom Cotton Polo Shirts (100 pcs) - Dark grey \/ 3Xlarge","public_title":"Dark grey \/ 3Xlarge","sku":null}]},"page":{"pageType":"product","resourceType":"product","resourceId":8933974311204}};
    for (var attr in meta) {
      window.ShopifyAnalytics.meta[attr] = meta[attr];
    }
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
      if (!design.preview_image.url) return;

      const image: HTMLImageElement | null = previewWrap.querySelector(
        ".pc-preview[data-pc-design-id='" +
          design.id +
          "'] img.pc-uploader-image"
      );

      if (image) {
        const designSrc =
          design.preview?.design?.url || design.preview_image.url;

        image.src = designSrc || "";
      } else {
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
          const newIds = input.value
            .split(",")
            .filter((id) => id !== design.id);

          input.value = newIds.join();

          preview.remove();
        };

        const image = document.createElement("img");
        const designSrc =
          design.preview?.design?.url || design.preview_image.url;
        image.src = designSrc;
        image.className = "pc-uploader-image";

        const overlay = document.createElement("div");
        overlay.className = "pc-preview-overlay";

        overlay.appendChild(editBtn);
        overlay.appendChild(removeBtn);
        preview.appendChild(overlay);
        preview.appendChild(image);
        previewWrap.appendChild(preview);
      }
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
        const designSrc = data.preview?.design?.url || data.preview_image.url;

        if (!designSrc) return;

        const img = document.querySelector(
          `[data-pc-design-id="${data.id}"] img`
        );

        if (!img || !(img instanceof HTMLImageElement)) {
          throw new Error("Can't find image element");
        }

        img.src = designSrc;

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

  async #createQuotationRequest(object: TPostQuotationRequest): Promise<any> {
    const loader = document.getElementsByClassName("pc-handle-overlay");
    const alertSuccess = document.getElementsByClassName("pc-alert-success");
    const alertDanger = document.getElementsByClassName("pc-alert-danger");
    if (alertSuccess[0]?.classList) {
      alertSuccess[0].classList.remove("active");
    }
    if (alertDanger[0]?.classList) {
      alertDanger[0].classList.remove("active");
    }
    if (loader[0]?.classList) {
      loader[0].classList.add("active");
    }

    const toggleLoader = (isTrue = false, mess = "") => {
      if (loader[0]?.classList) {
        loader[0].classList.remove("active");
      }

      if (isTrue && alertSuccess[0]?.classList) {
        alertSuccess[0].classList.add("active");
        return;
      }

      if (alertDanger[0]?.classList) {
        alertDanger[0].classList.add("active");
        alertDanger[0].textContent = mess;
      }
    };

    try {
      const printcartApiUrl = `${this.#apiUrl}quotation-requests`;

      if (!object.name || !object.email) {
        toggleLoader(false, "Name and Email are required");
        return;
      }

      const token = this.token || "";
      if (!token) {
        toggleLoader(false, "Missing Printcart Unauth Token");
        return;
      }

      const formData = new FormData();
      formData.append("name", object.name);
      formData.append("product_id", object.product_id);
      formData.append("email", object.email);
      formData.append("phone", object.phone);
      formData.append("whatsapp", object.whatsapp);
      formData.append("note", object.note);
      if (object.design_file) {
        formData.append("design_file", object.design_file);
      }

      fetch(printcartApiUrl, {
        method: "POST",
        headers: {
          "X-PrintCart-Unauth-Token": token,
        },
        body: formData,
      }).then((res) => {
        if (!res.ok) {
          res.json().then((error) => {
            toggleLoader(false, error.message);
          });
          return;
        }

        const form = document.getElementById(
          "quotation-request-form"
        ) as HTMLFormElement;
        form.reset();

        toggleLoader(true);
      });
    } catch (error) {
      //@ts-ignore

      toggleLoader(false, "Failed to create quotation request");
      return;
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
      const lang = localStorage.getItem("pc_lang") || "en";
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

    if (button && button instanceof HTMLButtonElement) {
      button.onclick = (e) => {
        e.preventDefault();
        if (
          this.#designerInstance &&
          !this.#uploaderInstance &&
          !this.#quotationRequestInstance
        ) {
          this.#designerInstance.render();
          return;
        }

        if (
          !this.#designerInstance &&
          this.#uploaderInstance &&
          !this.#quotationRequestInstance
        ) {
          this.#uploaderInstance.open();
          return;
        }

        if (
          !this.#designerInstance &&
          !this.#uploaderInstance &&
          this.#quotationRequestInstance
        ) {
          this.#openQRModal();
          return;
        }

        if (
          this.#designerInstance ||
          this.#uploaderInstance ||
          this.#quotationRequestInstance
        ) {
          this.#openModal();
        }
      };
    }
  }

  #openQRModal() {
    const modal = document.getElementById("pc-quotation-request_wrap");

    if (modal) {
      modal.style.display = "flex";
      document.body.classList.add("pc-overflow");
    }

    const closeBtn = modal?.querySelector("#pc-qr_close-btn");
    if (closeBtn && closeBtn instanceof HTMLButtonElement) closeBtn.focus();
  }

  #closeQRModal() {
    const modal = document.getElementById("pc-quotation-request_wrap");

    if (modal) {
      modal.style.display = "none";
    }

    document.body.classList.remove("pc-overflow");
  }

  #initializeQuoteRequest(product: any) {
    const formatCurrency = (amount: number, currency: string): string => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
      }).format(amount);
    };

    let currencyHtml = ``;
    if (
      product?.request_quote_options?.additionalFee &&
      product?.request_quote_options?.additionalFee > 0 &&
      product?.request_quote_options?.currency?.symbol
    ) {
      const amount = parseFloat(product?.request_quote_options?.additionalFee);
      const code = product?.request_quote_options?.currency?.code;
      currencyHtml = `<span class="pc-currency text-danger">Please note that an additional fee of <b>${formatCurrency(
        amount,
        code
      )}</b> applies to custom design requests. Thank you for your understanding!</span>`;
    }

    const inner = `
      <button aria-label="Close" id="pc-qr_close-btn"><span data-modal-x></span></button>
      <div id="pc-qr-content-overlay">
      <div class="pc-select-inner">
        <div id="pc-select_container">
        <form id="quotation-request-form">
          <div class="pc-card_header">
          <h2>Send the request</h2>
          ${currencyHtml ? currencyHtml : ""}
          <div class="pc-alert pc-alert-success">
            <div class="success__title">Your quotation request has been successfully created</div>
          </div>
          <div class="pc-alert pc-alert-danger">
            <div class="success__title">Something went wrong. Please try again later.</div>
          </div>
          </div>
          <div class="pc-card_body">
          <div>
            <label for="pc-name">Name<span class="pc-field-require">*</span></label>
            <input id="pc-name" type="text" name="pc-name" required />
          </div>
          <div>
            <label for="pc-email">Email<span class="pc-field-require">*</span></label>
            <input id="pc-email" type="email" name="pc-email" required />
          </div>
          <div>
            <label for="pc-phone">Phone</label>
            <input id="pc-phone" type="tel" name="pc-phone" />
          </div>
          <div>
            <label for="pc-whatsapp">WhatsApp</label>
            <input id="pc-whatsapp" type="tel" name="pc-whatsapp" />
          </div>
          <div>
            <label for="pc-note">Note</label>
            <description data-i18n="note_desc"></description>
            <textarea id="pc-note" name="pc-note"></textarea>
          </div>
          <div>
            <label for="pc-file">File</label>
            <description data-i18n="file_desc"></description>
            <input id="pc-file" type="file" name="pc-file" title="Choose a file from your device"/>
          </div>
          </div>
          <div class="pc-card_footer">
            <button id="pc-submit-quota" type="submit">Submit</button>
          </div>
          <div class="pc-handle-overlay">
          <div class="pc-boxes">
            <div class="pc-box"><div></div><div></div><div></div><div></div>
            </div>
            <div class="pc-box"><div></div><div></div><div></div><div></div>
            </div>
            <div class="pc-box"><div></div><div></div><div></div><div></div>
            </div>
            <div class="pc-box"><div></div><div></div><div></div><div></div>
            </div>
          </div>
          </div>
        </form>
        </div>
      </div>
      </div>
    `;

    const wrap = document.createElement("div");
    wrap.id = "pc-quotation-request_wrap";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("tabIndex", "-1");
    wrap.innerHTML = inner;
    document.body.appendChild(wrap);

    const closeModalBtn = document.getElementById("pc-qr_close-btn");

    const btnSubmitEl = document.getElementById(
      "pc-submit-quota"
    ) as HTMLButtonElement;

    const handleClose = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.#closeQRModal();
      }
    };

    window.addEventListener("keydown", handleClose);
    closeModalBtn?.addEventListener("click", () => this.#closeQRModal());

    btnSubmitEl?.addEventListener("click", (e) =>
      this.#handleQuotationRequest(product?.id, e)
    );
  }

  #handleQuotationRequest(productId: string, e: any) {
    e.preventDefault();

    const form = document.getElementById(
      "quotation-request-form"
    ) as HTMLFormElement;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const nameEl = document.getElementsByName("pc-name")[0] as HTMLInputElement;
    const phoneEl = document.getElementsByName("pc-phone")[0] as HTMLInputElement;
    const whatsappEl = document.getElementsByName(
      "pc-whatsapp"
    )[0] as HTMLInputElement;
    const emailEl = document.getElementsByName("pc-email")[0] as HTMLInputElement;
    const noteEl = document.getElementsByName("pc-note")[0] as HTMLInputElement;
    const fileEl = document.getElementsByName("pc-file")[0] as HTMLInputElement;
    const files: any = fileEl.files;

    const quote = {
      name: nameEl.value || "",
      email: emailEl.value || "",
      phone: phoneEl.value || "",
      whatsapp: whatsappEl.value || "",
      note: noteEl.value || "",
      design_file: files ? files[0] : null,
      product_id: productId,
    };

    this.#createQuotationRequest(quote);
  }

  #quotationRequestOpen() {
    this.#openQRModal();
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
