const { chromium } = require('playwright');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500  // 慢一点，方便观察
  });
  
  const context = await browser.newContext({
    locale: 'zh-CN'
  });
  const page = await context.newPage();
  
  try {
    console.log('Opening Gitee signup page...');
    await page.goto('https://gitee.com/signup', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('Filling registration form...');
    
    // 填写用户名
    await page.fill('input[name="user[login]"]', 'gkl888');
    await page.waitForTimeout(500);
    
    // 填写邮箱
    await page.fill('input[name="user[email]"]', '198981734@qq.com');
    await page.waitForTimeout(500);
    
    // 填写手机号
    await page.fill('input[name="user[phone]"]', '19957905619');
    await page.waitForTimeout(500);
    
    // 填写密码
    await page.fill('input[name="user[password]"]', 'gkl8852546');
    await page.waitForTimeout(500);
    
    // 填写确认密码
    const confirmPasswordInput = await page.$('input[name="user[password_confirmation]"]');
    if (confirmPasswordInput) {
      await confirmPasswordInput.fill('gkl8852546');
      await page.waitForTimeout(500);
    }
    
    console.log('Form filled. Waiting for verification code...');
    console.log('Please enter the SMS verification code when you receive it:');
    
    // 等待用户输入验证码
    const code = await new Promise(resolve => {
      rl.question('Verification code: ', answer => {
        resolve(answer);
      });
    });
    
    // 尝试填写验证码
    const codeInput = await page.$('input[name="user[verification_code]"], input[placeholder*="验证码"], input.verification-code');
    if (codeInput) {
      await codeInput.fill(code);
    }
    
    // 点击注册按钮
    const submitBtn = await page.$('button[type="submit"], input[type="submit"], .submit-btn');
    if (submitBtn) {
      await submitBtn.click();
    }
    
    await page.waitForTimeout(5000);
    console.log('Registration attempt completed. Current URL:', page.url());
    
    // 截图保存结果
    await page.screenshot({ path: 'gitee-signup-result.png', fullPage: true });
    console.log('Screenshot saved to gitee-signup-result.png');
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'gitee-signup-error.png' });
  }
  
  console.log('\nBrowser will stay open. Press Ctrl+C to close.');
  // 不关闭浏览器，让用户看到结果
})();
