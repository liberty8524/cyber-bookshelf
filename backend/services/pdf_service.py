"""PDF validation boundary; future text extraction can live alongside this service."""
from pypdf import PdfReader
from fastapi import HTTPException

def inspect_pdf(path):
    try:
        with path.open("rb") as stream:
            if stream.read(1024).find(b"%PDF-") < 0:
                raise ValueError("文件不是有效的 PDF")
            stream.seek(0)
            reader = PdfReader(stream)
            if reader.is_encrypted:
                raise ValueError("暂不支持加密 PDF，请先解密")
            total = len(reader.pages)
            if not total:
                raise ValueError("PDF 没有可阅读的页面")
            metadata = reader.metadata or {}
            return total, str(metadata.get("/Title") or ""), str(metadata.get("/Author") or "")
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(400, "PDF 已损坏或无法解析，请选择有效文件") from exc
