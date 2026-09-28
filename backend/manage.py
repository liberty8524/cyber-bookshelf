"""Local-only account management. Run: python -m backend.manage --help."""
import argparse
from getpass import getpass
from backend.database import initialize, connection
from backend.services.auth_service import claim_legacy, hash_password

def main():
    parser = argparse.ArgumentParser(description="藏间本机管理工具")
    sub = parser.add_subparsers(dest="command", required=True)
    claim = sub.add_parser("claim-legacy", help="将尚未归属的旧版藏书移交给已注册账号")
    claim.add_argument("username")
    reset = sub.add_parser("reset-password", help="本机管理员重设密码并撤销该账号全部会话")
    reset.add_argument("username")
    args = parser.parse_args()
    initialize()
    if args.command == "claim-legacy":
        try:
            count = claim_legacy(args.username)
        except ValueError as exc:
            parser.error(str(exc))
        print(f"已将 {count} 本旧版藏书归入 {args.username}，PDF 与阅读进度均保留。")
    else:
        with connection() as db:
            user = db.execute("SELECT id FROM users WHERE username=?", (args.username.lower(),)).fetchone()
        if not user:
            parser.error("账号不存在")
        password = getpass("新密码（15—128 个字符，不会显示）：")
        if not 15 <= len(password) <= 128 or password != getpass("再次输入："):
            parser.error("密码长度不符或两次输入不一致")
        encoded = hash_password(password)
        with connection() as db:
            db.execute("UPDATE users SET password_hash=? WHERE id=?", (encoded,user["id"]))
            db.execute("DELETE FROM sessions WHERE user_id=?", (user["id"],))
        print("密码已更新，该账号的所有设备均需重新登录。")

if __name__ == "__main__":
    main()
