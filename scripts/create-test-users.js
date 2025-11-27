/**
 * テストユーザー作成スクリプト
 * Supabase Auth経由でテストユーザーを作成
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Service Role Key必要

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 環境変数が設定されていません');
  console.error('EXPO_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUsers() {
  console.log('🚀 テストユーザー作成開始...');

  try {
    // テストユーザーA (iOS用)
    console.log('\n📱 iOS用テストユーザー作成中...');
    const { data: iOSUser, error: iOSError } = await supabase.auth.admin.createUser({
      email: 'test-ios123@testetst.com',
      password: 'password01',
      email_confirm: true,
      user_metadata: {
        display_name: 'Test iOS User',
        platform: 'ios'
      }
    });

    if (iOSError) {
      console.error('❌ iOS用ユーザー作成エラー:', iOSError.message);
    } else {
      console.log('✅ iOS用ユーザー作成成功:', {
        id: iOSUser.user.id,
        email: iOSUser.user.email
      });
    }

    // テストユーザーB (Android用)
    console.log('\n🤖 Android用テストユーザー作成中...');
    const { data: androidUser, error: androidError } = await supabase.auth.admin.createUser({
      email: 'test-android123@testetst.com',
      password: 'password02',
      email_confirm: true,
      user_metadata: {
        display_name: 'Test Android User',
        platform: 'android'
      }
    });

    if (androidError) {
      console.error('❌ Android用ユーザー作成エラー:', androidError.message);
    } else {
      console.log('✅ Android用ユーザー作成成功:', {
        id: androidUser.user.id,
        email: androidUser.user.email
      });
    }

    console.log('\n🎉 テストユーザー作成完了');
    console.log('\n📋 作成されたユーザー:');
    console.log('iOS用: test-ios123@testetst.com / password01');
    console.log('Android用: test-android123@testetst.com / password02');

  } catch (error) {
    console.error('❌ 予期しないエラー:', error);
  }
}

createTestUsers();