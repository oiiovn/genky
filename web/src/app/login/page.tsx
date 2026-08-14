import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f5ff]">
      {/* Ảnh nền — phần dashboard/people nằm bên phải */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "url('/images/auth-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "right center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Lớp gradient nhẹ bên trái để form dễ đọc */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[55%] bg-gradient-to-r from-white/70 via-white/35 to-transparent lg:block"
      />

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {/* Form đẩy sang TRÁI */}
        <div className="flex w-full items-center justify-center px-4 py-8 sm:px-8 lg:w-[46%] lg:justify-center lg:px-10 xl:w-[42%]">
          <LoginForm />
        </div>

        {/* Phải: khoảng trống lộ ảnh nền */}
        <div className="hidden flex-1 lg:block" aria-hidden />
      </div>
    </div>
  );
}
