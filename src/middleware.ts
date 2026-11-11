import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = 'demo-auth';
const AUTH_PATH = '/demo-auth';

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const authHtml = ({ redirectTo, error = false }: { redirectTo: string; error?: boolean }): string => {
  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/';
  const errorClass = error ? ' has-error' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentication Required</title>
  <link rel="icon" href="/favicon.svg">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-7px); }
      40%     { transform: translateX(7px); }
      60%     { transform: translateX(-4px); }
      80%     { transform: translateX(4px); }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      padding: 24px;
    }

    .card {
      background: #fff;
      border-radius: 20px;
      box-shadow:
        0 1px 3px rgba(0,0,0,.06),
        0 8px 24px rgba(0,0,0,.08),
        0 32px 64px rgba(47,107,222,.08);
      padding: 52px 44px 44px;
      width: 100%;
      max-width: 400px;
      animation: fadeSlideIn .5s cubic-bezier(.16,1,.3,1) both;
    }

    .lock-wrap {
      width: 56px;
      height: 56px;
      background: #2F6BDE;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 28px;
      box-shadow: 0 8px 20px rgba(47,107,222,.35);
    }

    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      text-align: center;
      letter-spacing: -.3px;
      margin-bottom: 6px;
    }

    .subtitle {
      font-size: 14px;
      color: #64748b;
      text-align: center;
      margin-bottom: 36px;
    }

    .field { margin-bottom: 20px; }

    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 7px;
    }

    .input-wrap {
      position: relative;
    }
    .field.has-error .input-wrap { animation: shake .38s cubic-bezier(.36,.07,.19,.97) both; }

    input {
      width: 100%;
      padding: 11px 42px 11px 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      font-size: 15px;
      color: #0f172a;
      outline: none;
      background: #fff;
      transition: border-color .15s, box-shadow .15s, background .15s;
      -webkit-appearance: none;
    }
    input:focus {
      border-color: #2F6BDE;
      box-shadow: 0 0 0 3px rgba(47,107,222,.18);
    }
    .field.has-error input {
      border-color: #ef4444;
      background: #fef2f2;
    }
    .field.has-error input:focus {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239,68,68,.18);
    }

    .eye-btn {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: #94a3b8;
      padding: 4px;
      display: flex;
      align-items: center;
      line-height: 0;
      transition: color .15s;
    }
    .eye-btn:hover { color: #475569; }

    .error-msg {
      font-size: 12.5px;
      color: #ef4444;
      margin-top: 6px;
      display: none;
      font-weight: 500;
    }
    .field.has-error .error-msg { display: block; }

    .submit-btn {
      width: 100%;
      padding: 12px;
      background: #2F6BDE;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: -.1px;
      transition: opacity .15s, transform .1s, box-shadow .15s;
      box-shadow: 0 4px 14px rgba(47,107,222,.4);
      margin-top: 4px;
    }
    .submit-btn:hover  { opacity: .9; box-shadow: 0 6px 20px rgba(47,107,222,.45); }
    .submit-btn:active { transform: scale(.98); opacity: .85; }
  </style>
</head>
<body>
  <div class="card">
    <div class="lock-wrap">
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    </div>
    <h1>Authentication Required</h1>
    <p class="subtitle">Enter password to continue</p>

    <form method="POST" action="${AUTH_PATH}">
      <input type="hidden" name="redirect_to" value="${safeRedirect}">
      <div class="field${errorClass}">
        <label for="pw">Password</label>
        <div class="input-wrap">
          <input type="password" id="pw" name="password" placeholder="Enter password" autofocus autocomplete="current-password">
          <button type="button" class="eye-btn" onclick="togglePw(this)" aria-label="Show/hide password">
            ${eyeSvg('open')}
          </button>
        </div>
        <div class="error-msg">Incorrect password — please try again.</div>
      </div>
      <button type="submit" class="submit-btn">Continue</button>
    </form>
  </div>

  <script>
    var eyeOpen = '${eyeSvg('open').replace(/'/g, "\\'")}';
    var eyeClosed = '${eyeSvg('closed').replace(/'/g, "\\'")}';
    function togglePw(btn) {
      var input = document.getElementById('pw');
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? eyeOpen : eyeClosed;
      input.focus();
    }
  </script>
</body>
</html>`;
}

const eyeSvg = (variant: 'open' | 'closed'): string => {
  if (variant === 'open') {
    return `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
  return `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
};

export const middleware = async (request: NextRequest) => {
  const demoPassword = process.env.DEMO_PASSWORD;
  const origin = request.headers.get('origin');

  if (demoPassword) {
    const expectedHash = await hashPassword(demoPassword);
    const { pathname } = request.nextUrl;

    if (pathname === '/favicon.svg') {
      return NextResponse.next();
    }

    if (request.method === 'POST' && pathname === AUTH_PATH) {
      const formData = await request.formData();
      const submitted = (formData.get('password') as string) ?? '';
      const redirectTo = (formData.get('redirect_to') as string) || '/';
      const submittedHash = await hashPassword(submitted);

      if (submittedHash === expectedHash) {
        const response = NextResponse.redirect(new URL(redirectTo, request.url));

        response.cookies.set(AUTH_COOKIE, expectedHash, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });

        return response;
      }

      return new NextResponse(authHtml({ redirectTo, error: true }), {
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const authCookie = request.cookies.get(AUTH_COOKIE)?.value;
    if (authCookie !== expectedHash) {
      return new NextResponse(authHtml({ redirectTo: pathname }), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  const response = NextResponse.next();

  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  return response;
}

export const config = {
  matcher: '/(.*)',
};
