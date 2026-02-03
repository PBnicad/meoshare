import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

// Cloudflare Workers 环境类型
export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  APP_URL: string;
}

// 创建 better-auth 实例工厂函数
export function createAuth(db: D1Database, env: Env) {
  return betterAuth({
    // Base URL (必需，用于 OAuth 回调)
    baseURL: env.APP_URL,

    // Secret (用于加密)
    secret: env.BETTER_AUTH_SECRET,

    // 使用 Cloudflare D1 adapter
    database: drizzleAdapter(db, {
      provider: 'sqlite',
    }),

    // GitHub OAuth 配置
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectUrl: `${env.APP_URL}/api/auth/callback/github`,
      },
    },

    // Session 配置
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },

    // 高级配置
    advanced: {
      cookiePrefix: 'meoshare',
      crossSubDomainCookies: {
        enabled: false,
      },
      useSecureCookies: env.APP_URL.startsWith('https'),
    },

    // 用户配置
    user: {
      additionalFields: {
        githubId: {
          type: 'string',
          required: false,
        },
        githubLogin: {
          type: 'string',
          required: false,
        },
        githubAvatar: {
          type: 'string',
          required: false,
        },
      },
    },

    // 禁用邮箱密码登录，只使用 GitHub OAuth
    emailAndPassword: {
      enabled: false,
    },
  });
}
