import { FormEvent, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { KeyRound, Lock, Mail, Shield } from 'lucide-react';
import { StardustButton } from './ui/StardustButton';
import ownerLogoUrl from '../assets/lucas-costa-logo-transparent.png';
import { useMediaQuery } from '../hooks/useMediaQuery';

export interface OwnerSession {
  name: string;
  email: string;
  remember?: boolean;
}

interface LoginScreenProps {
  onLogin: (session: OwnerSession) => void;
}

const OWNER_EMAIL = ((import.meta as any).env.VITE_OWNER_EMAIL as string | undefined)?.trim().toLowerCase();
const OWNER_PASSWORD = ((import.meta as any).env.VITE_OWNER_PASSWORD as string | undefined)?.trim();
const CREDENCIAL_NO_BUILD = Boolean(OWNER_EMAIL && OWNER_PASSWORD);
const MOBILE_QUERY = '(max-width: 767px)';

const isInitiallyMobile = () =>
  typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;

/* Os campos liam "esticados" (2026-08-04) e a causa era proporção, não
   largura sozinha: numa coluna de 384px o campo tinha 46px de altura -- razão
   de ~8:1, que é faixa, não campo. A correção é dos dois lados ao mesmo
   tempo: a coluna estreitou para 330px e o campo subiu para ~52px, o que leva
   a razão para ~5,6:1. Só estreitar deixaria o campo baixo do mesmo jeito.
   `py-3` -> `py-3.5` e `text-sm` -> 15px, que é o corpo de controle do resto
   do app (o campo de busca de Conversas usa o mesmo). */
const fieldClassName = `w-full bg-[rgba(25,25,25,0.6)]
  border border-[rgba(100,100,100,0.4)] rounded-2xl py-3.5 pl-11 pr-4 text-[15px]
  focus:outline-none focus:border-purple-500
  shadow-[inset_0_1px_4px_rgba(255,255,255,0.05),inset_0_-1px_4px_rgba(0,0,0,0.6)]
  transition-all duration-200 placeholder-gray-400`;

/* Centro real: com o campo mais alto, um `top` fixo desalinha o icone. */
const iconClassName = 'absolute left-4 top-1/2 -translate-y-1/2 text-[#6a3dff]';

const BackgroundCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 16, 125);
    camera.lookAt(new THREE.Vector3(0, 28, 0));

    class Plane {
      uniforms: { time: { value: number } };
      speed: number;
      mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.RawShaderMaterial>;

      constructor() {
        this.uniforms = { time: { value: 0 } };
        this.speed = 0.5;
        this.mesh = this.createMesh();
      }

      createMesh() {
        return new THREE.Mesh(
          new THREE.PlaneGeometry(256, 256, 256, 256),
          new THREE.RawShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `
              attribute vec3 position;
              uniform mat4 projectionMatrix;
              uniform mat4 modelViewMatrix;
              uniform float time;
              varying vec3 vPosition;

              mat4 rotateMatrixX(float radian) {
                return mat4(
                  1.0, 0.0, 0.0, 0.0,
                  0.0, cos(radian), -sin(radian), 0.0,
                  0.0, sin(radian), cos(radian), 0.0,
                  0.0, 0.0, 0.0, 1.0
                );
              }

              vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
              vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
              vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
              vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
              vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

              float cnoise(vec3 P) {
                vec3 Pi0 = floor(P);
                vec3 Pi1 = Pi0 + vec3(1.0);
                Pi0 = mod289(Pi0);
                Pi1 = mod289(Pi1);
                vec3 Pf0 = fract(P);
                vec3 Pf1 = Pf0 - vec3(1.0);
                vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
                vec4 iy = vec4(Pi0.yy, Pi1.yy);
                vec4 iz0 = Pi0.zzzz;
                vec4 iz1 = Pi1.zzzz;
                vec4 ixy = permute(permute(ix) + iy);
                vec4 ixy0 = permute(ixy + iz0);
                vec4 ixy1 = permute(ixy + iz1);
                vec4 gx0 = ixy0 * (1.0 / 7.0);
                vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
                gx0 = fract(gx0);
                vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
                vec4 sz0 = step(gz0, vec4(0.0));
                gx0 -= sz0 * (step(0.0, gx0) - 0.5);
                gy0 -= sz0 * (step(0.0, gy0) - 0.5);
                vec4 gx1 = ixy1 * (1.0 / 7.0);
                vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
                gx1 = fract(gx1);
                vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
                vec4 sz1 = step(gz1, vec4(0.0));
                gx1 -= sz1 * (step(0.0, gx1) - 0.5);
                gy1 -= sz1 * (step(0.0, gy1) - 0.5);
                vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
                vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
                vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
                vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
                vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
                vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
                vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
                vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);
                vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
                g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
                vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
                g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
                float n000 = dot(g000, Pf0);
                float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
                float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
                float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
                float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
                float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
                float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
                float n111 = dot(g111, Pf1);
                vec3 fade_xyz = fade(Pf0);
                vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
                vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
                float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
                return 2.2 * n_xyz;
              }

              void main(void) {
                vec3 updatePosition = (rotateMatrixX(radians(90.0)) * vec4(position, 1.0)).xyz;
                float sin1 = sin(radians(updatePosition.x / 128.0 * 90.0));
                vec3 noisePosition = updatePosition + vec3(0.0, 0.0, time * -30.0);
                float noise1 = cnoise(noisePosition * 0.08);
                float noise2 = cnoise(noisePosition * 0.06);
                float noise3 = cnoise(noisePosition * 0.4);
                vec3 lastPosition = updatePosition + vec3(
                  0.0,
                  noise1 * sin1 * 8.0 +
                  noise2 * sin1 * 8.0 +
                  noise3 * (abs(sin1) * 2.0 + 0.5) +
                  pow(sin1, 2.0) * 40.0,
                  0.0
                );
                vPosition = lastPosition;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(lastPosition, 1.0);
              }
            `,
            fragmentShader: `
              precision highp float;
              varying vec3 vPosition;
              void main(void) {
                float opacity = (96.0 - length(vPosition)) / 256.0 * 0.6;
                vec3 color = vec3(0.6);
                gl_FragColor = vec4(color, opacity);
              }
            `,
            transparent: true,
          })
        );
      }

      render(delta: number) {
        this.uniforms.time.value += delta * this.speed;
      }
    }

    const plane = new Plane();
    scene.add(plane.mesh);
    renderer.setSize(window.innerWidth, window.innerHeight);
    const clock = new THREE.Clock();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    let animationFrameId: number;
    const animate = () => {
      plane.render(clock.getDelta());
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      scene.remove(plane.mesh);
      plane.mesh.geometry.dispose();
      plane.mesh.material.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed left-0 top-0 z-0 block h-full w-full" />;
};

interface MorphingTextProps {
  onFinished?: () => void;
}

const MorphingText = ({ onFinished }: MorphingTextProps) => {
  const text1Ref = useRef<HTMLSpanElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const text1 = text1Ref.current;
    const text2 = text2Ref.current;
    const container = containerRef.current;
    if (!text1 || !text2 || !container) return;

    const texts = ['Organize', 'Simplifique', 'Execute.'];
    const morphTime = 0.8;
    const delayBetween = 200;
    const entranceDelay = 200;
    const exitHold = 500;
    const exitDuration = 1300;
    const glowFilter =
      'drop-shadow(0 0 3px rgba(106,61,255,0.8)) drop-shadow(0 0 10px rgba(106,61,255,0.25))';

    container.style.filter = glowFilter;
    text1.textContent = texts[0];
    text2.textContent = texts[1];
    text1.style.opacity = '1';
    text1.style.filter = 'none';
    text1.style.transform = 'translateY(0px)';
    text2.style.opacity = '0';
    text2.style.filter = 'none';

    let animationFrameId: number | null = null;
    const timeouts: number[] = [];

    const setStyles = (fraction: number, index: number) => {
      const safeFraction = Math.max(fraction, 0.001);
      const invFraction = 1 - fraction;
      const safeInvFraction = Math.max(invFraction, 0.001);

      text2.style.filter = `blur(${Math.min(8 / safeFraction - 8, 100)}px)`;
      text2.style.opacity = `${Math.pow(safeFraction, 0.4) * 100}%`;
      text1.style.filter = `blur(${Math.min(8 / safeInvFraction - 8, 100)}px)`;
      text1.style.opacity = `${Math.pow(safeInvFraction, 0.4) * 100}%`;
      text1.textContent = texts[index];
      text2.textContent = texts[index + 1];
    };

    const runMorph = (fromIndex: number, onComplete: () => void) => {
      const start = performance.now();

      const step = (now: number) => {
        const elapsed = (now - start) / 1000;
        const fraction = Math.min(elapsed / morphTime, 1);
        container.style.filter = `url(#threshold) blur(0.6px) ${glowFilter}`;
        setStyles(fraction, fromIndex);

        if (fraction < 1) {
          animationFrameId = requestAnimationFrame(step);
          return;
        }

        container.style.filter = glowFilter;
        text1.textContent = texts[fromIndex + 1];
        text1.style.opacity = '100%';
        text1.style.filter = 'none';
        text2.textContent = '';
        text2.style.opacity = '0%';
        text2.style.filter = 'none';
        onComplete();
      };

      animationFrameId = requestAnimationFrame(step);
    };

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms);
        timeouts.push(id);
      });

    const runExit = async () => {
      await new Promise<void>((resolve) => {
        const start = performance.now();
        let cardTriggered = false;

        const step = (now: number) => {
          const t = Math.min((now - start) / exitDuration, 1);
          const eased = t < 0.25 ? t * 1.8 : 1 - Math.pow(1 - t, 2);
          const opacity = 1 - eased;
          const blur = eased * 5;

          text1.style.opacity = String(opacity);
          text1.style.filter = `blur(${blur}px)`;

          if (t >= 0.8 && !cardTriggered) {
            cardTriggered = true;
            onFinished?.();
          }

          if (t < 1) {
            animationFrameId = requestAnimationFrame(step);
          } else {
            text1.style.opacity = '0';
            text1.style.filter = `blur(${blur}px)`;
            resolve();
          }
        };

        animationFrameId = requestAnimationFrame(step);
      });
    };

    const runSequence = async () => {
      await wait(entranceDelay);
      await new Promise<void>((resolve) => runMorph(0, resolve));
      await wait(delayBetween);
      await new Promise<void>((resolve) => runMorph(1, resolve));
      await wait(exitHold);
      await runExit();
    };

    runSequence();

    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, [onFinished]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed left-1/2 top-[40%] z-10 h-[120px] w-full max-w-[800px] -translate-x-1/2 -translate-y-1/2 select-none text-center font-sans text-5xl font-bold tracking-wider text-[#6a3dff] transition-filter duration-100 ease-out sm:text-7xl lg:text-[5rem]"
      style={{
        filter:
          'drop-shadow(0 0 3px rgba(106, 61, 255, 0.8)) drop-shadow(0 0 10px rgba(106, 61, 255, 0.25))',
      }}
    >
      <div className="relative h-full w-full">
        <span ref={text1Ref} className="absolute inset-0 m-auto inline-block w-full" />
        <span ref={text2Ref} className="absolute inset-0 m-auto inline-block w-full" />
      </div>
      <svg id="filters" className="hidden">
        <defs>
          <filter id="threshold">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
};

function LoginCard({ onLogin }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  const enterClassName = `transition-[opacity,transform,filter] duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
    show ? 'translate-y-0 scale-100 opacity-100 blur-0' : 'translate-y-8 scale-[0.98] opacity-0 blur-[6px]'
  }`;
  const enterStyle = (delay: number) => ({ transitionDelay: show ? `${delay}ms` : '0ms' });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '').trim();
    const confirmPassword = String(form.get('confirmPassword') || '').trim();
    const remember = form.get('remember') === 'on';

    setError('');

    // Build sem credencial embutida (o caso do deploy): a tela e passagem, nao
    // barreira. `VITE_*` vai dentro do bundle que qualquer um baixa, entao
    // conferir aqui nunca protegeu nada — exigir o segredo so travava a porta
    // pra quem tem a chave. Quem protege dado e o token do lado da API.
    if (!CREDENCIAL_NO_BUILD) {
      onLogin({ name: 'Proprietário', email: email || 'proprietario', remember });
      return;
    }

    if (!email) {
      setError('Informe o e-mail de acesso.');
      return;
    }

    if (!password) {
      setError('Informe a senha de acesso.');
      return;
    }

    if (email !== OWNER_EMAIL || password !== OWNER_PASSWORD) {
      setError('E-mail ou senha incorretos.');
      return;
    }

    if (!isLogin && confirmPassword && confirmPassword !== password) {
      setError('As senhas não conferem.');
      return;
    }

    onLogin({ name: 'Proprietário', email, remember });
  }

  return (
    <div
      className="relative z-10 flex min-h-dvh flex-col items-center justify-center pb-12 text-white"
    >
      <div className="flex w-full max-w-[330px] flex-col items-center gap-5 px-6">
        <div className={`text-center ${enterClassName}`} style={enterStyle(0)}>
          <img
            src={ownerLogoUrl}
            alt="Lucas Costa Barbearia"
            className="mx-auto mb-6 h-52 w-52 object-contain"
            draggable={false}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-soft/80">
            Área do proprietário
          </p>
          {!isLogin && (
            <p className="mt-1 text-sm leading-tight text-gray-400">
              Acesso exclusivo para clientes ativos
            </p>
          )}
        </div>

        <div
          className={`relative flex w-full rounded-3xl border border-[rgba(168,85,247,0.25)]
          bg-[linear-gradient(180deg,rgba(25,25,25,0.9)_0%,rgba(10,10,10,0.8)_100%)]
          p-[6px] shadow-[inset_0_0_10px_rgba(255,255,255,0.05),0_0_18px_rgba(168,85,247,0.15)]
          backdrop-blur-sm ${enterClassName}`}
          style={enterStyle(140)}
        >
          <button
            type="button"
            className={`flex-1 rounded-2xl py-2.5 min-h-[44px] text-[15px] font-medium transition-all duration-300 ${
              isLogin
                ? 'bg-[linear-gradient(180deg,rgba(40,40,40,1)_0%,rgba(15,15,15,1)_100%)] text-white shadow-[inset_0_0_8px_rgba(255,255,255,0.15),0_0_10px_rgba(168,85,247,0.2)]'
                : 'text-gray-400 hover:text-white hover:shadow-[0_0_8px_rgba(168,85,247,0.1)]'
            }`}
            onClick={() => setIsLogin(true)}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`flex-1 rounded-2xl py-2.5 min-h-[44px] text-[15px] font-medium transition-all duration-300 ${
              !isLogin
                ? 'bg-[linear-gradient(180deg,rgba(40,40,40,1)_0%,rgba(15,15,15,1)_100%)] text-white shadow-[inset_0_0_8px_rgba(255,255,255,0.15),0_0_10px_rgba(168,85,247,0.2)]'
                : 'text-gray-400 hover:text-white hover:shadow-[0_0_8px_rgba(168,85,247,0.1)]'
            }`}
            onClick={() => setIsLogin(false)}
          >
            Cadastrar
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="w-full rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-center text-sm text-red-100 shadow-[0_0_18px_rgba(239,68,68,0.08)]"
          >
            {error}
          </div>
        )}

        {isLogin ? (
          <form className="flex w-full flex-col gap-4" onSubmit={handleSubmit}>
            <div className={`relative ${enterClassName}`} style={enterStyle(240)}>
              <label htmlFor="login-email" className="sr-only">E-mail</label>
              <Mail className={iconClassName} size={18} />
              <input
                id="login-email"
                className={fieldClassName}
                type="email"
                name="email"
                placeholder="E-mail"
                autoComplete="email"
                defaultValue={OWNER_EMAIL ?? ''}
              />
            </div>

            <div className={`relative ${enterClassName}`} style={enterStyle(320)}>
              <label htmlFor="login-password" className="sr-only">Senha de acesso</label>
              <Lock className={iconClassName} size={18} />
              <input
                id="login-password"
                className={fieldClassName}
                type="password"
                name="password"
                placeholder="Senha de acesso"
                autoComplete="current-password"
                defaultValue={OWNER_PASSWORD ?? ''}
              />
            </div>

            <div className={`flex items-center justify-between text-sm text-gray-400 ${enterClassName}`} style={enterStyle(400)}>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="remember" className="accent-purple-500" />
                <span>Lembrar-me</span>
              </label>
              <button type="button" className="transition-all hover:text-white">
                Esqueceu a senha?
              </button>
            </div>

            <div className={`flex justify-center pt-4 ${enterClassName}`} style={enterStyle(500)}>
              <StardustButton type="submit">Entrar</StardustButton>
            </div>
          </form>
        ) : (
          <form className="flex w-full flex-col gap-4" onSubmit={handleSubmit}>
            <div className={`relative ${enterClassName}`} style={enterStyle(240)}>
              <label htmlFor="register-email" className="sr-only">E-mail</label>
              <Mail className={iconClassName} size={18} />
              <input id="register-email" className={fieldClassName} type="email" name="email" placeholder="E-mail" autoComplete="email" />
            </div>

            <div className={`relative ${enterClassName}`} style={enterStyle(320)}>
              <label htmlFor="register-password" className="sr-only">Senha</label>
              <Lock className={iconClassName} size={18} />
              <input id="register-password" className={fieldClassName} type="password" name="password" placeholder="Senha" autoComplete="new-password" />
            </div>

            <div className={`relative ${enterClassName}`} style={enterStyle(400)}>
              <label htmlFor="register-confirm" className="sr-only">Confirme sua senha</label>
              <Shield className={iconClassName} size={18} />
              <input
                id="register-confirm"
                className={fieldClassName}
                type="password"
                name="confirmPassword"
                placeholder="Confirme sua senha"
                autoComplete="new-password"
              />
            </div>

            <div className={`relative ${enterClassName}`} style={enterStyle(480)}>
              <label htmlFor="register-code" className="sr-only">Código de acesso</label>
              <KeyRound className={iconClassName} size={18} />
              <input id="register-code" className={fieldClassName} type="text" name="accessCode" placeholder="Código de acesso" autoComplete="off" />
            </div>

            <div className={`flex justify-center pt-4 ${enterClassName}`} style={enterStyle(580)}>
              <StardustButton type="submit">Solicitar acesso</StardustButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [showCard, setShowCard] = useState(isInitiallyMobile);

  useEffect(() => {
    if (isMobile) {
      setShowCard(true);
      return;
    }
    if (showCard) return;
    const fallback = window.setTimeout(() => setShowCard(true), 5200);
    return () => window.clearTimeout(fallback);
  }, [isMobile, showCard]);

  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#0e0e10] font-sans">
      <BackgroundCanvas />

      {!isMobile && !showCard && <MorphingText onFinished={() => setShowCard(true)} />}

      {showCard && <LoginCard onLogin={onLogin} />}
    </div>
  );
}
