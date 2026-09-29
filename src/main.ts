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

type TPhoneMode = "hidden" | "optional" | "required";

interface IUploadIntakeFormConfig {
  phone: TPhoneMode;
  note: boolean;
  require_consent: boolean;
  consent_text: string | null;
  store_name: string | null;
}

interface IUploadIntakeResult {
  intake_uuid: string;
  reference: string;
  project_id?: string;
  status?: string;
  buyer?: { name: string; email: string };
}

type TUploadIntakeFormState = {
  name: string;
  email: string;
  phone: string;
  note: string;
  consent: boolean;
};

type TUploadIntakeSubmitResult =
  | { ok: true; data: IUploadIntakeResult }
  | { ok: false; kind: "validation"; message: string }
  | { ok: false; kind: "fallback" };

const DEFAULT_UPLOAD_INTAKE_FORM_CONFIG: IUploadIntakeFormConfig = {
  phone: "optional",
  note: true,
  require_consent: false,
  consent_text: null,
  store_name: null,
};

// Generates a fresh idempotency key per "submit attempt group" (one per modal
// open / retry-group), per order-upload-buyer-journey-spec.vi.md §14.1.
function genIdempotencyKey(): string {
  // @ts-ignore
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Best-effort prefill from whatever the theme happens to expose. Never throws,
// never assumes a field exists — most themes expose none of this on a product
// page, that's fine, the fields just start empty.
function prefillBuyerInfo(): { name: string; email: string; phone: string } {
  try {
    // @ts-ignore
    const customer = window?.Shopify?.customer || window?.ShopifyAnalytics?.meta?.page?.customer;

    if (!customer) return { name: "", email: "", phone: "" };

    const name =
      customer.name ||
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      "";

    return {
      name,
      email: customer.email || "",
      phone: customer.phone || customer?.default_address?.phone || "",
    };
  } catch (error) {
    return { name: "", email: "", phone: "" };
  }
}

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
  #variantId: string | null;
  #uploadIntakeFormConfig: IUploadIntakeFormConfig;
  #noticeTimeout?: ReturnType<typeof setTimeout>;
  locales: ILocales;

  constructor() {
    this.token = this.#getUnauthToken();
    this.productId = null;
    this.#quotationRequestInstance = false;
    this.#variantId = null;
    this.#uploadIntakeFormConfig = { ...DEFAULT_UPLOAD_INTAKE_FORM_CONFIG };

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

  async #initializeProductTools(variantId: string | null) {
    if (!variantId) {
      const shopifyMetaData = window?.ShopifyAnalytics?.meta;
      variantId = shopifyMetaData?.selectedVariantId;
    }

    if (!variantId) {
      throw new Error("Can not find product variant ID");
    }

    this.#variantId = variantId;

    const printcartProduct: any = await this.#getPrintcartProduct(variantId);

    this.productId = printcartProduct?.data?.id;

    const isDesignEnabled = printcartProduct.data.enable_design;
    const isUploadEnabled = printcartProduct.data.enable_upload;
    const isQuotationRequest = printcartProduct.data.enable_request_quote;

    // Language
    await this.#language();

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
      await this.#getUploadIntakeFormConfig();

      this.#uploaderInstance = new PrintcartUploader({
        token: this.token,
        productId: this.productId,
      });

      this.#registerUploaderEvents();
    }

    if (isQuotationRequest) {
      this.#quotationRequestInstance = true;
      this.#initializeQuoteRequest(printcartProduct.data);
    }

    if (isUploadEnabled || isDesignEnabled || isQuotationRequest) {
      this.#createBtn();
    }

    await this.#openSelectModal();
    await this.#registerCloseModal();
    await this.#modalTrap();
    await this.#applyLanguage();
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
    const containerWrap = document.getElementById("pc-select_wrap");
    if (containerWrap) {
      containerWrap.remove();
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
        // order-upload-buyer-journey-spec.vi.md §5, §12b, §14.1: before the
        // design is attached to the cart, ask for name/email (no "Skip" —
        // David 2026-09-28: "an upload without an email is useless").
        this.#openIntakeModal(data);
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

  #fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { ...options, signal: controller.signal }).finally(() =>
      clearTimeout(timeoutId)
    );
  }

  async #getUploadIntakeFormConfig(): Promise<void> {
    try {
      const token = this.token;
      if (!token) return;

      const res = await this.#fetchWithTimeout(
        `${this.#apiUrl}upload-intakes/form-config`,
        { headers: { "X-PrintCart-Unauth-Token": token } },
        15000
      );

      if (!res.ok) return;

      const json = await res.json();

      if (json?.data) {
        this.#uploadIntakeFormConfig = {
          phone: json.data.phone ?? DEFAULT_UPLOAD_INTAKE_FORM_CONFIG.phone,
          note: json.data.note ?? DEFAULT_UPLOAD_INTAKE_FORM_CONFIG.note,
          require_consent:
            json.data.require_consent ??
            DEFAULT_UPLOAD_INTAKE_FORM_CONFIG.require_consent,
          consent_text:
            json.data.consent_text ??
            DEFAULT_UPLOAD_INTAKE_FORM_CONFIG.consent_text,
          store_name:
            json.data.store_name ?? DEFAULT_UPLOAD_INTAKE_FORM_CONFIG.store_name,
        };
      }
    } catch (error) {
      //@ts-ignore
      console.error("[Printcart] Failed to load upload intake form config", error);
    }
  }

  // One silent retry on network error / timeout / 5xx (and any other
  // non-422 failure) — order-upload-buyer-journey-spec.vi.md §14.1/§16.1:
  // a failed intake must never block the sale. 422 is a real validation
  // error and is surfaced to the buyer without retrying.
  async #submitUploadIntake(
    body: Record<string, unknown>
  ): Promise<TUploadIntakeSubmitResult> {
    const attempt = (): Promise<Response> => {
      const token = this.token || "";

      return this.#fetchWithTimeout(
        `${this.#apiUrl}upload-intakes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-PrintCart-Unauth-Token": token,
          },
          body: JSON.stringify(body),
        },
        15000
      );
    };

    const handle = async (res: Response): Promise<TUploadIntakeSubmitResult> => {
      if (res.ok) {
        const json = await res.json();
        return { ok: true, data: json?.data as IUploadIntakeResult };
      }

      if (res.status === 422) {
        let message = "Please check your details and try again.";

        try {
          const json = await res.json();
          message = json?.message || message;
        } catch (parseError) {
          // keep default message
        }

        return { ok: false, kind: "validation", message };
      }

      throw new Error(`upload-intake request failed with status ${res.status}`);
    };

    try {
      return await handle(await attempt());
    } catch (error) {
      //@ts-ignore
      console.warn("[Printcart] upload-intake failed, retrying once", error);

      try {
        return await handle(await attempt());
      } catch (error2) {
        //@ts-ignore
        console.warn(
          "[Printcart] upload-intake retry failed — continuing without intake",
          error2
        );
        return { ok: false, kind: "fallback" };
      }
    }
  }

  #getPlatformProductInfo(): { productId: string | null; name: string | null } {
    try {
      // @ts-ignore
      const meta = window?.ShopifyAnalytics?.meta;
      const productId = meta?.product?.id != null ? String(meta.product.id) : null;
      const name =
        meta?.product?.title ||
        document
          .querySelector("h1.product__title, h1.product-title, h1")
          ?.textContent?.trim() ||
        null;

      return { productId, name };
    } catch (error) {
      return { productId: null, name: null };
    }
  }

  #getQuantity(): number {
    const form = this.#cartForm ?? this.#productForm;
    const input = form?.querySelector(
      'input[name="quantity"], select[name="quantity"]'
    ) as HTMLInputElement | HTMLSelectElement | null;
    const value = input ? parseInt(input.value, 10) : NaN;

    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  #writeIntakeProperty(intakeUuid: string) {
    let input = <HTMLInputElement>(
      document.querySelector('input[name="properties[_pcIntake]"]')
    );

    if (!input) {
      input = <HTMLInputElement>document.createElement("input");
      input.type = "hidden";
      input.name = "properties[_pcIntake]";
      input.className = "pc-designer_input";

      if (this.#cartForm) {
        this.#cartForm.appendChild(input);
      } else {
        this.#productForm?.appendChild(input);
      }
    }

    input.value = intakeUuid;
  }

  #showTransientNotice(message: string) {
    const wrap = document.getElementById("pc-designer_wrap");
    if (!wrap) return;

    let notice = document.getElementById("pc-intake-cancel-notice");

    if (!notice) {
      notice = document.createElement("div");
      notice.id = "pc-intake-cancel-notice";
      notice.className = "pc-intake-cancel-notice";
      notice.setAttribute("role", "status");
      wrap.appendChild(notice);
    }

    notice.textContent = message;

    if (this.#noticeTimeout) clearTimeout(this.#noticeTimeout);

    this.#noticeTimeout = setTimeout(() => {
      notice?.remove();
    }, 6000);
  }

  #closeIntakeModal() {
    const modal = document.getElementById("pc-intake_wrap");
    if (modal) modal.remove();

    document.body.classList.remove("pc-overflow");
  }

  #trapIntakeModalFocus(modal: HTMLElement) {
    const focusableEls = modal.querySelectorAll<HTMLElement>(
      'button, input:not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusableEl = focusableEls[0];
    const lastFocusableEl = focusableEls[focusableEls.length - 1];

    const handleTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusableEl) {
          e.preventDefault();
          lastFocusableEl?.focus();
        }
      } else if (document.activeElement === lastFocusableEl) {
        e.preventDefault();
        firstFocusableEl?.focus();
      }
    };

    modal.addEventListener("keydown", handleTrap);
    firstFocusableEl?.focus();

    return () => modal.removeEventListener("keydown", handleTrap);
  }

  #openIntakeModal(data: [DataWrap]) {
    const ids = data.map((design) => design.data.id);
    const files = ids.map((id) => ({ type: "design", id }));
    const config = this.#uploadIntakeFormConfig;
    const storeName = config.store_name || "the store";
    const prefill = prefillBuyerInfo();
    const idempotencyKey = genIdempotencyKey();
    const phoneMode = config.phone;
    const showNote = config.note !== false;
    const requireConsent = !!config.require_consent;
    const consentText =
      config.consent_text ||
      `I agree to receive emails about this order from ${storeName}.`;

    const existing = document.getElementById("pc-intake_wrap");
    if (existing) existing.remove();

    const inner = `
      <button aria-label="Close" id="pc-intake_close-btn"><span data-modal-x></span></button>
      <div id="pc-intake-content-overlay">
        <div class="pc-select-inner">
          <div id="pc-select_container">
            <form id="pc-intake-form" novalidate>
              <div class="pc-card_header">
                <h2 id="pc-intake-title">Send your file to ${escapeHtml(storeName)}</h2>
                <p class="pc-intake-subtitle">We just need a couple details so we can keep you posted about this file.</p>
                <div class="pc-alert pc-alert-danger" id="pc-intake-error"></div>
              </div>
              <div class="pc-card_body">
                <div>
                  <label for="pc-intake-name">Name<span class="pc-field-require">*</span></label>
                  <input id="pc-intake-name" type="text" name="name" autocomplete="name" value="${escapeHtml(
                    prefill.name
                  )}" required />
                  <span class="pc-intake-field-error" data-error-for="name"></span>
                </div>
                <div>
                  <label for="pc-intake-email">Email<span class="pc-field-require">*</span></label>
                  <input id="pc-intake-email" type="email" name="email" autocomplete="email" value="${escapeHtml(
                    prefill.email
                  )}" required />
                  <span class="pc-intake-field-error" data-error-for="email"></span>
                </div>
                ${
                  phoneMode !== "hidden"
                    ? `<div>
                  <label for="pc-intake-phone">Phone${
                    phoneMode === "required"
                      ? '<span class="pc-field-require">*</span>'
                      : " (optional)"
                  }</label>
                  <input id="pc-intake-phone" type="tel" name="phone" autocomplete="tel" value="${escapeHtml(
                    prefill.phone
                  )}" ${phoneMode === "required" ? "required" : ""} />
                  <span class="pc-intake-field-error" data-error-for="phone"></span>
                </div>`
                    : ""
                }
                ${
                  showNote
                    ? `<div>
                  <label for="pc-intake-note">Note for the store (optional)</label>
                  <textarea id="pc-intake-note" name="note" maxlength="500"></textarea>
                </div>`
                    : ""
                }
                <div class="pc-ui-consent-row">
                  <input type="checkbox" id="pc-intake-consent" name="consent" ${
                    requireConsent ? "required" : ""
                  } />
                  <label for="pc-intake-consent">${escapeHtml(consentText)}${
      requireConsent ? '<span class="pc-field-require">*</span>' : ""
    }</label>
                </div>
                <span class="pc-intake-field-error" data-error-for="consent"></span>
              </div>
              <div class="pc-card_footer">
                <button type="submit" id="pc-intake-submit">Send file</button>
              </div>
              <div class="pc-handle-overlay" id="pc-intake-loader">
                <div class="pc-boxes">
                  <div class="pc-box"><div></div><div></div><div></div><div></div></div>
                  <div class="pc-box"><div></div><div></div><div></div><div></div></div>
                  <div class="pc-box"><div></div><div></div><div></div><div></div></div>
                  <div class="pc-box"><div></div><div></div><div></div><div></div></div>
                </div>
              </div>
            </form>
            <div id="pc-intake-success" class="pc-intake-success" style="display:none;">
              <div class="pc-intake-success-icon" aria-hidden="true">&#10003;</div>
              <h2 id="pc-intake-success-title">File received</h2>
              <div class="pc-ui-reference-badge" id="pc-intake-reference"></div>
              <p>We&#39;ve saved your file. A confirmation email is on its way.</p>
              <button type="button" id="pc-intake-continue">Continue</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const wrap = document.createElement("div");
    wrap.id = "pc-intake_wrap";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "pc-intake-title");
    wrap.setAttribute("tabIndex", "-1");
    wrap.innerHTML = inner;

    document.body.appendChild(wrap);
    wrap.style.display = "flex";
    document.body.classList.add("pc-overflow");

    const removeTrap = this.#trapIntakeModalFocus(wrap);

    const cancel = () => {
      removeTrap();
      window.removeEventListener("keydown", handleEscape);
      this.#closeIntakeModal();
      this.#uploaderInstance?.close();
      this.#showTransientNotice(
        "Add your name and email to send your file."
      );
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };

    window.addEventListener("keydown", handleEscape);

    const closeBtn = document.getElementById("pc-intake_close-btn");
    closeBtn?.addEventListener("click", cancel);

    const form = document.getElementById("pc-intake-form") as HTMLFormElement;
    const submitBtn = document.getElementById(
      "pc-intake-submit"
    ) as HTMLButtonElement;
    const loader = document.getElementById("pc-intake-loader");
    const errorBanner = document.getElementById("pc-intake-error");
    const successView = document.getElementById("pc-intake-success");
    const continueBtn = document.getElementById("pc-intake-continue");
    const referenceEl = document.getElementById("pc-intake-reference");

    const setSubmitting = (isSubmitting: boolean) => {
      loader?.classList.toggle("active", isSubmitting);
      submitBtn.disabled = isSubmitting;
      submitBtn.textContent = isSubmitting ? "Sending..." : "Send file";
      Array.from(form.elements).forEach((el) => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.disabled = isSubmitting;
        }
      });
    };

    const clearFieldErrors = () => {
      form
        .querySelectorAll(".pc-intake-field-error")
        .forEach((el) => (el.textContent = ""));
    };

    const showFieldError = (field: string, message: string) => {
      const el = form.querySelector(`[data-error-for="${field}"]`);
      if (el) el.textContent = message;
    };

    const validate = (state: TUploadIntakeFormState): boolean => {
      clearFieldErrors();
      let valid = true;

      if (!state.name.trim()) {
        showFieldError("name", "Required");
        valid = false;
      }

      if (!state.email.trim()) {
        showFieldError("email", "Required");
        valid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
        showFieldError("email", "Invalid email");
        valid = false;
      }

      if (phoneMode === "required" && !state.phone.trim()) {
        showFieldError("phone", "Required");
        valid = false;
      }

      if (requireConsent && !state.consent) {
        showFieldError("consent", "Required");
        valid = false;
      }

      return valid;
    };

    const readForm = (): TUploadIntakeFormState => {
      const nameEl = form.elements.namedItem("name") as HTMLInputElement | null;
      const emailEl = form.elements.namedItem("email") as HTMLInputElement | null;
      const phoneEl = form.elements.namedItem("phone") as HTMLInputElement | null;
      const noteEl = form.elements.namedItem("note") as HTMLTextAreaElement | null;
      const consentEl = form.elements.namedItem(
        "consent"
      ) as HTMLInputElement | null;

      return {
        name: nameEl?.value || "",
        email: emailEl?.value || "",
        phone: phoneEl?.value || "",
        note: noteEl?.value || "",
        consent: consentEl?.checked || false,
      };
    };

    const finishWithoutIntake = () => {
      this.#handleUploadSuccess(data);
      this.#uploaderInstance?.close();
      this.#closeIntakeModal();
    };

    const showSuccess = (result: IUploadIntakeResult) => {
      form.style.display = "none";
      if (successView) successView.style.display = "block";
      if (referenceEl) referenceEl.textContent = result.reference || "";

      continueBtn?.addEventListener(
        "click",
        () => {
          removeTrap();
          window.removeEventListener("keydown", handleEscape);
          this.#handleUploadSuccess(data);
          this.#writeIntakeProperty(result.intake_uuid);
          this.#uploaderInstance?.close();
          this.#closeIntakeModal();
        },
        { once: true }
      );

      continueBtn?.focus();
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (errorBanner) {
        errorBanner.classList.remove("active");
        errorBanner.textContent = "";
      }

      const state = readForm();
      if (!validate(state)) return;

      setSubmitting(true);

      const platformInfo = this.#getPlatformProductInfo();

      const result = await this.#submitUploadIntake({
        idempotency_key: idempotencyKey,
        platform: "shopify",
        product: {
          printcart_product_id: this.productId,
          platform_product_id: platformInfo.productId,
          platform_variant_id: this.#variantId,
          name: platformInfo.name,
        },
        quantity: this.#getQuantity(),
        files,
        buyer: {
          name: state.name.trim(),
          email: state.email.trim(),
          phone: state.phone.trim() || null,
          note: state.note.trim() || null,
          consent: state.consent,
        },
        page_url: typeof location !== "undefined" ? location.href : null,
      });

      setSubmitting(false);

      if (result.ok) {
        showSuccess(result.data);
        return;
      }

      if (result.kind === "validation") {
        if (errorBanner) {
          errorBanner.textContent = result.message;
          errorBanner.classList.add("active");
        }
        return;
      }

      // Network error / timeout / 5xx after one retry: never lose the sale.
      finishWithoutIntake();
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
    const phoneEl = document.getElementsByName(
      "pc-phone"
    )[0] as HTMLInputElement;
    const whatsappEl = document.getElementsByName(
      "pc-whatsapp"
    )[0] as HTMLInputElement;
    const emailEl = document.getElementsByName(
      "pc-email"
    )[0] as HTMLInputElement;
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
    let cssString: any;
    let textReplace: any;
    const store: any = await this.#getStoreDetail();
    cssString = store?.data?.setting_defaults?.customCss.value;
    textReplace = store?.data?.setting_defaults?.textReplace;

    if (
      store?.data?.language &&
      (store.data.language === "en" || store.data.language === "es")
    ) {
      localStorage.setItem("pc_lang", store.data.language);
    } else {
      localStorage.setItem("pc_lang", "en");
    }

    this.locales = {
      ...this.locales,
      en: {
        start_design: textReplace?.start_design
          ? textReplace.start_design
          : this.locales.en.start_design,
        pc_select_header: textReplace?.pc_select_header
          ? textReplace.pc_select_header
          : this.locales.en.pc_select_header,
        upload_a_full_design: textReplace?.upload_a_full_design
          ? textReplace.upload_a_full_design
          : this.locales.en.upload_a_full_design,
        upload_design_file: textReplace?.upload_design_file
          ? textReplace.upload_design_file
          : this.locales.en.upload_design_file,
        have_a_complete_design: textReplace?.have_a_complete_design
          ? textReplace.have_a_complete_design
          : this.locales.en.have_a_complete_design,
        have_your_own_design: textReplace?.have_your_own_design
          ? textReplace.have_your_own_design
          : this.locales.en.have_your_own_design,
        design_here_online: textReplace?.design_here_online
          ? textReplace.design_here_online
          : this.locales.en.design_here_online,
        already_have_a_design: textReplace?.already_have_a_design
          ? textReplace.already_have_a_design
          : this.locales.en.already_have_a_design,
        customize_every_details: textReplace?.customize_every_details
          ? textReplace.customize_every_details
          : this.locales.en.customize_every_details,
        request_us_to_design: textReplace?.request_us_to_design
          ? textReplace.request_us_to_design
          : this.locales.en.request_us_to_design,
        share_your_idea: textReplace?.share_your_idea
          ? textReplace.share_your_idea
          : this.locales.en.share_your_idea,
        our_designers_do_st: textReplace?.our_designers_do_st
          ? textReplace.our_designers_do_st
          : this.locales.en.our_designers_do_st,
        note_desc: textReplace?.note_desc
          ? textReplace.note_desc
          : this.locales.en.note_desc,
        file_desc: textReplace?.file_desc
          ? textReplace.file_desc
          : this.locales.en.file_desc,
      },
    };

    if (cssString) {
      const styleElement = document.createElement("style");

      styleElement.textContent = cssString;
      styleElement.type = "text/css";

      document.head.appendChild(styleElement);
    }
  }

  #applyLanguage() {
    const defaultLanguage = localStorage.getItem("pc_lang") || "en";
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
