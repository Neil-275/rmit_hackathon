## Chạy giao diện hiện tại

Mở trực tiếp [public/ui/index.html](public/ui/index.html) bằng Chrome/Edge; không cần Next.js hay Docker.
Đây là bản **MOCK dùng dữ liệu giả**, chưa kết nối TideCloak/backend LIVE. Xem
[hướng dẫn sử dụng](public/ui/README.md) và [bàn giao cho Tùng](docs/integration/static-ui-handoff.md).
Các phần dưới mô tả mục tiêu sản phẩm và kiến trúc cần được xác minh khi tích hợp LIVE.

## Project overview

**VoiceVault** is a cryptographically enforced employee voice platform protecting bottom-up ideas and whistleblowing reports without requiring employees to trust their organization's hierarchy or administrators.

### Vision & originality
Idea boxes and whistleblowing hotlines both fail because whoever controls the channel controls the speaker's identity. VoiceVault unifies them: **Sealed-Credited Ideas** keep authors anonymous during review—staying permanently encrypted if rejected to prevent ridicule, while automatically unlocking credit upon approval. **Protected Reports** pair conflict-free random jury selection with threshold identity decryption.

### Trust constraint insight
Employees withhold bold ideas fearing ridicule if judged infeasible, or credit theft by middle managers if successful. Whistleblowers stay silent because admins or executives can unmask them—especially when the accused sits on the review board. Eliminating unilateral control makes speaking up mathematically safe.

### Value & impact
Employees innovate and report misconduct safely; companies capture unvarnished ideas and early risk warnings. When engineer An submits an idea, manager Binh cannot steal credit, and An faces zero embarrassment if Director Chi rejects it. When An reports misconduct involving an ethics committee member, that member is automatically excluded before a random jury is assigned.

### Why TideCloak matters
Standard backends let DBAs alter authors, read identities, or self-assign roles. VoiceVault uses TideCloak's Emergent Authority to encrypt identities client-side. Decryption only happens when policy conditions are met—either formal idea approval or a 2/3 quorum from a randomly selected, conflict-free ethics jury. No admin or CEO can unilaterally override this.

### Prototype & storytelling
Our prototype demonstrates both flows across Engineer, Manager, Director, IT Admin, and Ethics Pool roles. Judges will see TideCloak block three violations: a manager altering authorship, an IT Admin self-assigning jury roles, and a CEO or conflicted board member attempting to unmask a whistleblower without a valid 2/3 quorum.
