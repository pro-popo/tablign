import { useState } from "react";
import { theme } from "@tablign/ui";
import { signInWithGoogle } from "../lib/oauth";

/** 구글 공식 4색 G 로고 */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

// 키프레임·반응형·진입 애니메이션은 인라인 스타일로 표현 불가 → 스코프된 <style>로 주입.
const css = `
.as-root{min-height:100vh;display:flex;background:${theme.surface};font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:${theme.text}}
.as-app{flex:1.5;display:flex;background:${theme.bg};overflow:hidden;opacity:.7}
.as-side{width:158px;flex:none;background:${theme.surface2};border-right:1px solid ${theme.border};padding:14px 11px;display:flex;flex-direction:column;gap:3px}
.as-brand{display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:2px}
.as-logo{width:25px;height:25px;border-radius:8px;background:${theme.text};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px}
.as-brand b{font-size:13px}
.as-lbl{font-size:12px;letter-spacing:.16em;color:${theme.textFaint};margin:4px 4px 2px}
.as-sp{display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:7px;font-size:12.5px;color:#5b636b}
.as-sp.on{background:${theme.accentWeak};color:${theme.accent};font-weight:600}
.as-sp .h{color:#c2c8cf}
.as-main{flex:1;padding:18px 20px;overflow:hidden}
.as-h{display:flex;align-items:baseline;gap:8px;margin-bottom:16px}
.as-h b{font-size:14px}
.as-h i{font-style:normal;color:${theme.textFaint};font-size:12.5px}
.as-col{margin-bottom:16px}
.as-colT{font-size:12px;color:#454c54;margin:0 0 8px;font-weight:600}
.as-row{display:flex;gap:10px}
.as-card{flex:1;min-width:0;background:${theme.surface};border:1px solid #edeef1;border-radius:9px;padding:10px 10px 11px;display:flex;flex-direction:column;gap:7px;box-shadow:0 1px 3px rgba(40,60,120,.05)}
.as-card .f{width:17px;height:17px;border-radius:5px}
.as-card .l1{height:6px;border-radius:3px;background:#e9ecf1;width:85%}
.as-card .l2{height:6px;border-radius:3px;background:#eef0f5;width:55%}
@keyframes asSnap{from{opacity:0;transform:translateY(9px) scale(.97)}to{opacity:1;transform:none}}
.as-app .as-card{animation:asSnap .55s cubic-bezier(.2,.8,.2,1) backwards}
.as-panel{flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:52px 40px;min-width:300px;background:#fff;position:relative;z-index:2;box-shadow:-22px 0 50px rgba(20,30,60,.16);border-left:1px solid #eef0f3}
.as-mono{width:46px;height:46px;border-radius:13px;background:${theme.text};color:#fff;font-weight:800;font-size:22px;display:flex;align-items:center;justify-content:center;margin-bottom:20px}
.as-panel h1{font-size:24px;letter-spacing:-.03em;line-height:1.14;margin:0 0 10px;font-weight:700}
.as-panel .sub{color:${theme.textMuted};font-size:13px;line-height:1.55;margin:0 0 24px}
.as-benefits{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:13px}
.as-benefit{display:flex;align-items:center;gap:10px;font-size:13px;color:#495057}
.as-ck{width:20px;height:20px;border-radius:50%;background:${theme.accentWeak};color:${theme.accent};display:flex;align-items:center;justify-content:center;flex:none;font-size:12px;font-weight:800}
.as-gbtn{width:100%;display:flex;align-items:center;justify-content:center;gap:11px;padding:13px 18px;border-radius:11px;border:none;background:${theme.accent};color:#fff;font-size:14.5px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px ${theme.accent}33;transition:opacity .15s,transform .05s}
.as-gbtn:hover{opacity:.94}
.as-gbtn:active{transform:translateY(1px)}
.as-gbtn:disabled{cursor:default;opacity:.6;box-shadow:none}
.as-gchip{width:24px;height:24px;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none}
.as-fine{margin:16px 0 0;font-size:12px;color:${theme.textFaint}}
.as-err{margin:14px 0 0;font-size:12.5px;color:${theme.danger};line-height:1.5}
@media (max-width:720px){.as-app{display:none}.as-panel{flex:1;align-items:center;text-align:center;box-shadow:none;border-left:none}}
@media (prefers-reduced-motion:reduce){.as-app .as-card{animation:none}}
`;

export function AuthScreen() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const err = await signInWithGoogle();
    setLoading(false);
    if (err) setError(err);
    // 성공 시 NewTab의 onAuthStateChange가 세션을 감지해 자동 렌더 전환
  }

  return (
    <div className="as-root">
      <style>{css}</style>

      {/* 좌측: 제품 미리보기(장식용) */}
      <div className="as-app" aria-hidden="true">
        <aside className="as-side">
          <div className="as-brand"><div className="as-logo">t</div><b>tablign</b></div>
          <div className="as-lbl">SPACES</div>
          <div className="as-sp on"><span className="h">#</span> 개인</div>
          <div className="as-sp"><span className="h">#</span> 업무</div>
          <div className="as-sp"><span className="h">#</span> 리서치</div>
        </aside>
        <div className="as-main">
          <div className="as-h"><b>개인</b><i>· 4 컬렉션</i></div>
          <div className="as-col">
            <div className="as-colT">읽을거리</div>
            <div className="as-row">
              <div className="as-card" style={{ animationDelay: "0.05s" }}><span className="f" style={{ background: "#EA4335" }} /><span className="l1" /><span className="l2" /></div>
              <div className="as-card" style={{ animationDelay: "0.11s" }}><span className="f" style={{ background: "#4285F4" }} /><span className="l1" /><span className="l2" /></div>
              <div className="as-card" style={{ animationDelay: "0.17s" }}><span className="f" style={{ background: "#10b981" }} /><span className="l1" /><span className="l2" /></div>
            </div>
          </div>
          <div className="as-col">
            <div className="as-colT">디자인 레퍼런스</div>
            <div className="as-row">
              <div className="as-card" style={{ animationDelay: "0.23s" }}><span className="f" style={{ background: "#a855f7" }} /><span className="l1" /><span className="l2" /></div>
              <div className="as-card" style={{ animationDelay: "0.29s" }}><span className="f" style={{ background: "#f59e0b" }} /><span className="l1" /><span className="l2" /></div>
              <div className="as-card" style={{ animationDelay: "0.35s" }}><span className="f" style={{ background: "#06b6d4" }} /><span className="l1" /><span className="l2" /></div>
            </div>
          </div>
          <div className="as-col">
            <div className="as-colT">개발 문서</div>
            <div className="as-row">
              <div className="as-card" style={{ animationDelay: "0.41s" }}><span className="f" style={{ background: "#6366f1" }} /><span className="l1" /><span className="l2" /></div>
              <div className="as-card" style={{ animationDelay: "0.47s" }}><span className="f" style={{ background: "#14b8a6" }} /><span className="l1" /><span className="l2" /></div>
              <div className="as-card" style={{ animationDelay: "0.53s" }}><span className="f" style={{ background: "#ef4444" }} /><span className="l1" /><span className="l2" /></div>
            </div>
          </div>
          <div className="as-col">
            <div className="as-colT">참고 자료</div>
            <div className="as-row">
              <div className="as-card" style={{ animationDelay: "0.59s" }}><span className="f" style={{ background: "#ec4899" }} /><span className="l1" /><span className="l2" /></div>
              <div className="as-card" style={{ animationDelay: "0.65s" }}><span className="f" style={{ background: "#0ea5e9" }} /><span className="l1" /><span className="l2" /></div>
              <div className="as-card" style={{ animationDelay: "0.71s" }}><span className="f" style={{ background: "#f97316" }} /><span className="l1" /><span className="l2" /></div>
            </div>
          </div>
        </div>
      </div>

      {/* 우측: 로그인 (상단 콘텐츠 / 하단 버튼) */}
      <div className="as-panel">
        <div className="as-top">
          <div className="as-mono">t</div>
          <h1>탭을 정렬하는<br />가장 단정한 방법.</h1>
          <p className="sub">열린 탭과 북마크를 컬렉션으로 모아 한눈에 관리하세요.</p>
          <ul className="as-benefits">
            <li className="as-benefit"><span className="as-ck">✓</span> 열린 탭을 한 번에 저장</li>
            <li className="as-benefit"><span className="as-ck">✓</span> 컬렉션·스페이스로 정리</li>
            <li className="as-benefit"><span className="as-ck">✓</span> 어느 기기에서나 동기화</li>
          </ul>
        </div>
        <div className="as-bottom">
          <button className="as-gbtn" type="button" onClick={handleGoogle} disabled={loading}>
            <span className="as-gchip"><GoogleIcon /></span>
            {loading ? "로그인 중…" : "Google로 계속하기"}
          </button>
          {error && <p className="as-err">{error}</p>}
        </div>
      </div>
    </div>
  );
}
