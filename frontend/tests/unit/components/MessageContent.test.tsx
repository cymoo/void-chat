import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageContent } from "@/components/chat/MessageContent";

describe("MessageContent", () => {
  describe("text type", () => {
    it("renders text content with HTML", () => {
      render(
        <MessageContent type="text" contentHtml="<p>Hello <strong>world</strong></p>" />,
      );
      expect(screen.getByText("world")).toBeInTheDocument();
      expect(screen.getByText("world").tagName).toBe("STRONG");
    });

    it("shows (edited) tag when editedAt is set", () => {
      render(
        <MessageContent type="text" contentHtml="<p>edited msg</p>" editedAt={1700000000000} />,
      );
      expect(screen.getByText("(edited)")).toBeInTheDocument();
    });

    it("does not show (edited) tag when editedAt is null", () => {
      render(
        <MessageContent type="text" contentHtml="<p>not edited</p>" editedAt={null} />,
      );
      expect(screen.queryByText("(edited)")).not.toBeInTheDocument();
    });

    it("applies custom textClassName", () => {
      const { container } = render(
        <MessageContent type="text" contentHtml="<p>hi</p>" textClassName="custom-text" />,
      );
      expect(container.querySelector(".custom-text")).toBeInTheDocument();
    });
  });

  describe("image type", () => {
    it("renders image with correct src", () => {
      render(
        <MessageContent type="image" imageUrl="/uploads/test.png" />,
      );
      const img = screen.getByAltText("Shared image");
      expect(img).toHaveAttribute("src", "/uploads/test.png");
    });

    it("calls onImageClick when image clicked", () => {
      const onImageClick = vi.fn();
      render(
        <MessageContent
          type="image"
          imageUrl="/uploads/test.png"
          onImageClick={onImageClick}
        />,
      );
      fireEvent.click(screen.getByAltText("Shared image"));
      expect(onImageClick).toHaveBeenCalledWith("/uploads/test.png");
    });

    it("shows 'shared an image' text", () => {
      render(
        <MessageContent type="image" imageUrl="/uploads/test.png" />,
      );
      expect(screen.getByText("shared an image")).toBeInTheDocument();
    });
  });

  describe("file type", () => {
    it("renders file with name, size, and download link", () => {
      render(
        <MessageContent
          type="file"
          fileName="report.pdf"
          fileUrl="/uploads/report.pdf"
          fileSize={2048}
        />,
      );
      expect(screen.getByText("report.pdf")).toBeInTheDocument();
      expect(screen.getByText("2.0 KB")).toBeInTheDocument();

      const downloadLink = screen.getByText("DOWNLOAD");
      expect(downloadLink).toHaveAttribute("href", "/uploads/report.pdf");
      expect(downloadLink).toHaveAttribute("download");
    });

    it("shows 'shared a file' text", () => {
      render(
        <MessageContent
          type="file"
          fileName="doc.txt"
          fileUrl="/uploads/doc.txt"
          fileSize={100}
        />,
      );
      expect(screen.getByText("shared a file")).toBeInTheDocument();
    });
  });
});
