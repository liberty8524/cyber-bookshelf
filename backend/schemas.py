from pydantic import BaseModel, Field, field_validator, ConfigDict

class BookEdit(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=1, max_length=300)
    author: str = Field(default="", max_length=200)
    category: str = Field(default="其他", min_length=1, max_length=50)
    description: str = Field(default="", max_length=5000)

    @field_validator("title", "category")
    @classmethod
    def trim_required(cls, value):
        if not value.strip():
            raise ValueError("内容不能为空")
        return value.strip()

class ProgressUpdate(BaseModel):
    current_page: int = Field(ge=1)
