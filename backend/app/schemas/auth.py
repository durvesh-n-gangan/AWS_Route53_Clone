from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    username: str
    account_id: str
