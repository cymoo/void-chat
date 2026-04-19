import { FileText } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

const IMAGE_MAX_WIDTH = 400;
const IMAGE_MAX_HEIGHT = 300;

type MessageContentProps = {
  /** CSS class for the text-wrapper div (default: "message-text") */
  textClassName?: string;
} & (
  | {
      type: "text";
      contentHtml: string;
      editedAt?: number | null;
    }
  | {
      type: "image";
      imageUrl: string;
      width?: number | null;
      height?: number | null;
      onImageClick?: () => void;
      onMediaLoad?: () => void;
    }
  | {
      type: "file";
      fileName: string;
      fileUrl: string;
      fileSize: number;
    }
);

/** Compute constrained display size for an image thumbnail. */
function getImageDisplaySize(w?: number | null, h?: number | null) {
  if (!w || !h) return undefined;
  const scale = Math.min(1, IMAGE_MAX_WIDTH / w, IMAGE_MAX_HEIGHT / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function MessageContent(props: MessageContentProps) {
  const textCls = props.textClassName ?? "message-text";

  switch (props.type) {
    case "text":
      return (
        <>
          <div
            className={`${textCls} markdown-body`}
            dangerouslySetInnerHTML={{ __html: props.contentHtml }}
          />
          {props.editedAt && <span className="edited-tag">(edited)</span>}
        </>
      );

    case "image": {
      const displaySize = getImageDisplaySize(props.width, props.height);
      const sizeStyle = displaySize
        ? { width: displaySize.width, height: displaySize.height }
        : undefined;
      return (
        <>
          <div className={textCls}>shared an image</div>
          <img
            src={props.imageUrl}
            className="message-image"
            style={sizeStyle}
            onClick={() => props.onImageClick?.()}
            onLoad={props.onMediaLoad}
            alt="Shared image"
          />
        </>
      );
    }

    case "file":
      return (
        <>
          <div className={textCls}>shared a file</div>
          <div className="message-file">
            <div className="file-icon">
              <FileText size={16} />
            </div>
            <div className="file-info">
              <div className="file-name">{props.fileName}</div>
              <div className="file-size">{formatFileSize(props.fileSize)}</div>
            </div>
            <a href={props.fileUrl} download className="file-download">
              DOWNLOAD
            </a>
          </div>
        </>
      );
  }
}
