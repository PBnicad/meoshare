import { Upload, Shield, Zap, Github } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function Landing() {
  const handleLogin = () => {
    window.location.href = '/api/auth/signin/github';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent animate-pulse-emerald" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="font-heading text-5xl md:text-6xl font-bold text-foreground mb-6 animate-fade-in-up opacity-0">
              MeoShare
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-4 animate-fade-in-up opacity-0 animation-delay-100">
              简单、安全的临时文件分享服务
            </p>
            <p className="text-muted-foreground mb-8 animate-fade-in-up opacity-0 animation-delay-200">
              上传文件，自动生成分享链接，文件将在指定时间后自动删除
            </p>
            <Button size="lg" onClick={handleLogin} className="gap-2 bg-emerald-600 hover:bg-emerald-700 hover:scale-105 transition-transform animate-fade-in-up opacity-0 animation-delay-300">
              <Github className="h-5 w-5" />
              开始使用
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-20 max-w-5xl mx-auto">
            <div className="flex flex-col items-center text-center p-6 animate-fade-in-up opacity-0 animation-delay-200 hover:scale-105 transition-transform">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 animate-float">
                <Upload className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">简单上传</h3>
              <p className="text-sm text-muted-foreground">
                支持任意文件类型，拖拽上传，一键分享
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 animate-fade-in-up opacity-0 animation-delay-300 hover:scale-105 transition-transform">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 animate-float animation-delay-200">
                <Shield className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">自动过期</h3>
              <p className="text-sm text-muted-foreground">
                文件将在1-30天后自动删除，保护隐私
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 animate-fade-in-up opacity-0 animation-delay-400 hover:scale-105 transition-transform">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 animate-float animation-delay-400">
                <Zap className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">快速稳定</h3>
              <p className="text-sm text-muted-foreground">
                基于 Cloudflare Workers，全球分发
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="container mx-auto px-4 py-20">
        <h2 className="font-heading text-3xl font-bold text-center mb-12 animate-fade-in opacity-0">如何使用</h2>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex gap-4 animate-fade-in-up opacity-0 animation-delay-100 hover:translate-x-2 transition-transform">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-emerald-50 flex items-center justify-center font-semibold">
              1
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">GitHub 登录</h3>
              <p className="text-muted-foreground">使用您的 GitHub 账号快速登录</p>
            </div>
          </div>

          <div className="flex gap-4 animate-fade-in-up opacity-0 animation-delay-200 hover:translate-x-2 transition-transform">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-primary-foreground flex items-center justify-center font-semibold">
              2
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">上传文件</h3>
              <p className="text-muted-foreground">
                选择要分享的文件，设置过期时间（1-30天）
              </p>
            </div>
          </div>

          <div className="flex gap-4 animate-fade-in-up opacity-0 animation-delay-300 hover:translate-x-2 transition-transform">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-primary-foreground flex items-center justify-center font-semibold">
              3
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">分享链接</h3>
              <p className="text-muted-foreground">
                获取分享链接，发送给需要的人，随时查看下载统计
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="bg-muted rounded-lg p-12 text-center max-w-2xl mx-auto animate-fade-in opacity-0 hover:shadow-lg hover:shadow-emerald-500/10 transition-shadow">
          <h2 className="font-heading text-2xl font-bold mb-4">准备好开始了吗？</h2>
          <p className="text-muted-foreground mb-6">
            登录后即可开始分享文件
          </p>
          <Button size="lg" onClick={handleLogin} className="gap-2 bg-emerald-600 hover:bg-emerald-700 hover:scale-105 transition-transform">
            <Github className="h-5 w-5" />
            GitHub 登录
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 animate-fade-in">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground space-y-2">
          <p>© {new Date().getFullYear()} MeoShare (喵喵快传). 基于 Cloudflare Workers 构建</p>
          <a
            href="https://github.com/PBnicad/meoshare"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
