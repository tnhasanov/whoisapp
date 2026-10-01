import { describe, expect, it } from "vitest";
import { classifyContact, contactKey, normaliseContactValue, normaliseEmail, normalisePhone } from "@/lib/contacts";
import type { ContactOwner, ContactType, SourceType } from "@/lib/domain/types";

type Input = Parameters<typeof classifyContact>[0];

function contact(overrides: Partial<Input> = {}): Input {
  return {
    type: "office_line",
    belongsTo: "person",
    value: "+994 12 555 01 23",
    publicationContext: "Contact details on the team page",
    supportingExcerpt: "Tel: +994 12 555 01 23",
    sourceType: "official_bio",
    selfPublished: false,
    valuePresentInSource: true,
    ...overrides,
  };
}

describe("classifyContact: reception and switchboard numbers", () => {
  it("a direct office line published on an official page stays direct", () => {
    expect(classifyContact(contact())).toEqual({ accepted: true, type: "office_line", belongsTo: "person", isDirect: true, note: null });
  });

  it("a switchboard is never direct and belongs to the organisation even if the model says person", () => {
    const decision = classifyContact(contact({ type: "switchboard", belongsTo: "person" }));
    expect(decision).toMatchObject({ accepted: true, type: "switchboard", belongsTo: "organisation", isDirect: false });
  });

  it.each([
    ["Reception", ""],
    ["", "General enquiries: +994 12 555 01 23"],
    ["General inquiries", ""],
    ["Main line", ""],
    ["Front desk", ""],
    ["Приемная", ""],
    ["Приёмная", ""],
    ["Qəbul otağı", ""],
    ["Qebul", ""],
  ])("reception wording (%s %s) converts an office line to the organisation switchboard", (context, excerpt) => {
    const decision = classifyContact(
      contact({ publicationContext: context, supportingExcerpt: excerpt || "Tel: +994 12 555 01 23" }),
    );
    expect(decision).toMatchObject({ accepted: true, type: "switchboard", belongsTo: "organisation", isDirect: false });
    if (decision.accepted) expect(decision.note).toMatch(/reception\/main line/);
  });

  it("reception wording also applies to a mobile number", () => {
    const decision = classifyContact(contact({ type: "business_mobile", publicationContext: "Front desk", sourceType: "news" }));
    expect(decision).toMatchObject({ accepted: true, type: "switchboard", belongsTo: "organisation", isDirect: false });
  });

  it("an office line attributed to the organisation is shown as its switchboard", () => {
    expect(classifyContact(contact({ belongsTo: "organisation" }))).toMatchObject({ type: "switchboard", belongsTo: "organisation", isDirect: false });
  });
});

describe("classifyContact: business mobiles", () => {
  it.each<[SourceType]>([["news"], ["official_bio"], ["company_site"], ["interview"], ["other"]])(
    "rejects a mobile attributed to the person on a %s page that the person did not publish",
    (sourceType) => {
      expect(classifyContact(contact({ type: "business_mobile", sourceType }))).toEqual({
        accepted: false,
        reason: "personal_mobile_not_self_published",
      });
    },
  );

  it.each<[SourceType]>([["personal_site"], ["social_profile"]])("accepts a mobile the person published on their own %s", (sourceType) => {
    expect(classifyContact(contact({ type: "business_mobile", sourceType }))).toMatchObject({
      accepted: true,
      type: "business_mobile",
      belongsTo: "person",
      isDirect: true,
    });
  });

  it("accepts a mobile when the extractor says the page is self-published", () => {
    expect(classifyContact(contact({ type: "business_mobile", sourceType: "interview", selfPublished: true }))).toMatchObject({
      accepted: true,
      isDirect: true,
      note: null,
    });
  });
});

describe("classifyContact: rejections", () => {
  it("rejects values that are not present in the source", () => {
    expect(classifyContact(contact({ valuePresentInSource: false }))).toEqual({ accepted: false, reason: "value_not_in_source" });
    expect(classifyContact(contact({ type: "work_email", value: "elnara.gasimova@caspian.example", valuePresentInSource: false }))).toEqual({
      accepted: false,
      reason: "value_not_in_source",
    });
  });

  it("rejects contacts found on search listings", () => {
    expect(classifyContact(contact({ sourceType: "search_listing" }))).toEqual({ accepted: false, reason: "unsupported_source" });
  });

  it("rejects blank values", () => {
    expect(classifyContact(contact({ value: "   " }))).toEqual({ accepted: false, reason: "invalid_value" });
  });
});

describe("classifyContact: owners", () => {
  it.each<[ContactOwner]>([["person"], ["organisation"], ["assistant"]])("assistant routes belong to the assistant (model said %s)", (belongsTo) => {
    expect(classifyContact(contact({ type: "assistant", belongsTo }))).toMatchObject({
      accepted: true,
      type: "assistant",
      belongsTo: "assistant",
      isDirect: false,
    });
  });

  it("a work email attributed to the organisation becomes its press office", () => {
    expect(classifyContact(contact({ type: "work_email", belongsTo: "organisation", value: "info@caspian.example" }))).toMatchObject({
      accepted: true,
      type: "press_office",
      belongsTo: "organisation",
      isDirect: false,
    });
  });

  it.each([["info@caspian.example"], ["Reception@caspian.example"], ["office2@caspian.example"]])(
    "a shared inbox (%s) attributed to the person is shown as an organisation address",
    (value) => {
      const decision = classifyContact(contact({ type: "work_email", belongsTo: "person", value }));
      expect(decision).toMatchObject({ accepted: true, type: "press_office", belongsTo: "organisation", isDirect: false });
      if (decision.accepted) expect(decision.note).toMatch(/general or reception inbox/);
    },
  );

  it("an email published as the reception address is never direct", () => {
    const decision = classifyContact(
      contact({ type: "work_email", value: "e.gasimova@caspian.example", publicationContext: "Listed as the reception email", supportingExcerpt: "Reception: e.gasimova@caspian.example" }),
    );
    expect(decision).toMatchObject({ accepted: true, belongsTo: "organisation", isDirect: false });
  });

  it.each<[ContactType]>([["press_office"], ["contact_page"]])("%s always belongs to the organisation", (type) => {
    expect(classifyContact(contact({ type, belongsTo: "person" }))).toMatchObject({ accepted: true, type, belongsTo: "organisation", isDirect: false });
  });

  it("flags a direct route published by a third party", () => {
    const decision = classifyContact(contact({ type: "work_email", value: "elnara@caspian.example", sourceType: "news" }));
    expect(decision).toMatchObject({ accepted: true, type: "work_email", belongsTo: "person", isDirect: true });
    if (decision.accepted) expect(decision.note).toMatch(/third party/);
  });
});

describe("normalisePhone", () => {
  it("formats numbers in international format", () => {
    expect(normalisePhone("+994 12 555 01 23")).toEqual({ display: "+994 12 555 01 23", normalised: "+994125550123", formatValid: true });
    expect(normalisePhone("(012) 555-01-23").normalised).toBe("+994125550123");
    expect(normalisePhone("020 7946 0123", "GB").normalised).toBe("+442079460123");
  });

  it("only reports formatting: a fictional but well-formed number is format-valid", () => {
    // 020 7946 0xxx is reserved for drama; it is well-formed yet reaches nobody.
    const result = normalisePhone("+44 20 7946 0123");
    expect(result.formatValid).toBe(true);
    expect(Object.keys(result).sort()).toEqual(["display", "formatValid", "normalised"]);
  });

  it("marks impossible numbers and keeps unparseable input as typed", () => {
    expect(normalisePhone("+994 123").formatValid).toBe(false);
    expect(normalisePhone("not a phone")).toEqual({ display: "not a phone", normalised: null, formatValid: null });
  });
});

describe("normaliseEmail / normaliseContactValue", () => {
  it("lower-cases emails for comparison and strips mailto:", () => {
    expect(normaliseEmail("mailto:Elnara@Caspian.EXAMPLE")).toEqual({ display: "Elnara@Caspian.EXAMPLE", normalised: "elnara@caspian.example", formatValid: true });
    expect(normaliseEmail("bad@").formatValid).toBe(false);
  });

  it("dispatches on the contact type and value", () => {
    expect(normaliseContactValue("work_email", "A@B.example").normalised).toBe("a@b.example");
    expect(normaliseContactValue("press_office", "Press@B.example").normalised).toBe("press@b.example");
    expect(normaliseContactValue("press_office", "+994 12 555 01 23").normalised).toBe("+994125550123");
    expect(normaliseContactValue("switchboard", "+994 12 555 01 23").display).toBe("+994 12 555 01 23");
    expect(normaliseContactValue("assistant", "office@b.example").normalised).toBe("office@b.example");
  });

  it("canonicalises contact page URLs", () => {
    expect(normaliseContactValue("contact_page", "https://www.caspian.example/contact/?utm_source=x")).toEqual({
      display: "https://www.caspian.example/contact/?utm_source=x",
      normalised: "https://caspian.example/contact",
      formatValid: true,
    });
    expect(normaliseContactValue("contact_page", "caspian.example/contact").formatValid).toBe(false);
  });
});

describe("contactKey", () => {
  it("combines the type with the normalised (or raw) value", () => {
    expect(contactKey("work_email", "a@b.example", "A@B.example")).toBe("work_email:a@b.example");
    expect(contactKey("switchboard", null, "+994 ABC")).toBe("switchboard:+994 abc");
  });
});
