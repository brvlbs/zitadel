import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CodeBoxes, isCompleteCode, normalizeCode } from "./code-boxes";

function setup(props: Partial<Parameters<typeof CodeBoxes>[0]> = {}) {
  const onChange = vi.fn();
  const onBlur = vi.fn();
  render(<CodeBoxes label="Code" name="code" onChange={onChange} onBlur={onBlur} data-testid="code-text-input" {...props} />);
  const input = screen.getByLabelText("Code") as HTMLInputElement;
  const boxes = () => screen.getAllByTestId("code-box").map((b) => b.textContent);
  return { input, boxes, onChange, onBlur };
}

describe("normalizeCode / isCompleteCode", () => {
  test("keeps digits only, at most six, leading zeros intact", () => {
    expect(normalizeCode("123 456")).toBe("123456");
    expect(normalizeCode("123-456")).toBe("123456");
    expect(normalizeCode(" 000123\n")).toBe("000123");
    expect(normalizeCode("12345678")).toBe("123456");
    expect(normalizeCode("ab12")).toBe("12");
  });

  test("only exactly six digits is complete", () => {
    expect(isCompleteCode("000000")).toBe(true);
    expect(isCompleteCode("12345")).toBe(false);
    expect(isCompleteCode("1234567")).toBe(false);
    expect(isCompleteCode("12345a")).toBe(false);
  });
});

describe("CodeBoxes", () => {
  afterEach(cleanup);

  test("is one labelled input with numeric keyboard and one-time-code autofill", () => {
    const { input } = setup();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("data-testid", "code-text-input");
    expect(screen.getAllByTestId("code-box")).toHaveLength(6);
  });

  test("typing fills the boxes in order", () => {
    const { input, boxes, onChange } = setup();
    fireEvent.change(input, { target: { value: "12" } });
    expect(boxes()).toEqual(["1", "2", "", "", "", ""]);
    expect(onChange).toHaveBeenCalled();
  });

  test("a pasted or autofilled code with separators fills all six, leading zeros kept", () => {
    const { input, boxes } = setup();
    fireEvent.change(input, { target: { value: "012 345" } });
    expect(input.value).toBe("012345");
    expect(boxes()).toEqual(["0", "1", "2", "3", "4", "5"]);
  });

  test("anything beyond six digits is dropped", () => {
    const { input, boxes } = setup();
    fireEvent.change(input, { target: { value: "98765432" } });
    expect(input.value).toBe("987654");
    expect(boxes()).toEqual(["9", "8", "7", "6", "5", "4"]);
  });

  test("backspace (a shorter value) clears the last box", () => {
    const { input, boxes } = setup();
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.change(input, { target: { value: "12345" } });
    expect(boxes()).toEqual(["1", "2", "3", "4", "5", ""]);
  });

  test("hint and error are announced through the input", () => {
    const { input } = setup({ hint: "Enter the 6-digit code.", error: "Invalid code" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby")!.split(" ");
    expect(describedBy).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid code");
    expect(document.getElementById(describedBy[0])).toHaveTextContent("Enter the 6-digit code.");
  });

  test("no error: not marked invalid", () => {
    const { input } = setup();
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a prefilled code is shown", () => {
    const { boxes } = setup({ defaultValue: "4 5 6" });
    expect(boxes()).toEqual(["4", "5", "6", "", "", ""]);
  });
});
