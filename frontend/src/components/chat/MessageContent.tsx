import { formatFileSize } from "@/lib/utils";

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
      onImageClick?: (url: string) => void;
      onMediaLoad?: () => void;
    }
  | {
      type: "file";
      fileName: string;
      fileUrl: string;
      fileSize: number;
    }
);

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

    case "image":
      return (
        <>
          <div className={textCls}>shared an image</div>
          <img
            src={props.imageUrl}
            className="message-image"
            onClick={() => props.onImageClick?.(props.imageUrl)}
            onLoad={props.onMediaLoad}
            alt="Shared image"
          />
        </>
      );

    case "file":
      return (
        <>
          <div className={textCls}>shared a file</div>
          <div className="message-file">
            <div className="file-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
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
