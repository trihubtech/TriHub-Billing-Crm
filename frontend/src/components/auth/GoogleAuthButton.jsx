import { GoogleLogin, useGoogleOneTapLogin } from "@react-oauth/google";
import { toast } from "react-toastify";

export default function GoogleAuthButton({ mode = "login", busy = false, onCredential, inline = false }) {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  
  useGoogleOneTapLogin({
    onSuccess: (response) => {
      if (response.credential) {
        onCredential(response.credential);
      }
    },
    onError: () => {
      console.warn("Google One Tap prompt could not be displayed");
    },
    disabled: !googleClientId || busy || mode === "verify",
  });

  if (!googleClientId) {
    return null;
  }

  if (inline) {
    return (
      <div className={`auth-google-inline${busy ? " is-busy" : ""}`}>
        <GoogleLogin
          onSuccess={(response) => {
            if (response.credential) onCredential(response.credential);
          }}
          onError={() => toast.error("Google verification failed")}
          type="icon"
          theme="outline"
          shape="square"
          size="large"
        />
      </div>
    );
  }

  return (
    <div className="auth-social-stack">
      <div className="auth-divider">
        <span>or continue with</span>
      </div>

      <div className={`auth-google-shell${busy ? " is-busy" : ""}`}>
        <GoogleLogin
          onSuccess={(response) => {
            if (!response.credential) {
              toast.error("Google sign-in could not be completed");
              return;
            }

            onCredential(response.credential);
          }}
          onError={() => toast.error("Google sign-in could not be started")}
          text={
            mode === "register" ? "signup_with" : 
            mode === "verify" ? "verify_with" : "signin_with"
          }
          theme="outline"
          shape="pill"
          size="large"
          width="100%"
        />
      </div>
    </div>
  );
}


