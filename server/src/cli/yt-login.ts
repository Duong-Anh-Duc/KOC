#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import logger from '../middlewares/logger.middleware';
import { YouTubeScraperService } from '../services/youtube-scraper.service';

/**
 * CLI Script: YouTube Studio One-Time Login
 * Run once to authenticate with Google. Session credentials are saved to .chrome-data/
 * Then all subsequent scraping will work without opening the browser.
 * 
 * Usage: npm run yt-login
 */

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       🌐 YouTube Studio One-Time Login Setup               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n📋 Instructions:');
  console.log('  1. A Chrome browser will open below');
  console.log('  2. Sign in with your Google account on YouTube Studio');
  console.log('  3. Your credentials will be saved automatically');
  console.log('  4. Close the browser when done');
  console.log('\n⏱️  Waiting for login... (Timeout: 120 seconds)\n');

  try {
    // Open browser headful for user to login
    const result = await YouTubeScraperService.openLoginBrowser();
    console.log(`✅ ${result.message}\n`);

    // Wait for user to login (120 seconds max)
    console.log('🔄 Waiting for authentication...');
    
    let loginSuccess = false;
    const startTime = Date.now();
    const timeout = 120 * 1000; // 120 seconds

    while (Date.now() - startTime < timeout) {
      // Check if credentials are saved
      const CHROME_USER_DATA_DIR = path.join(process.cwd(), '.chrome-data');
      const cookiesPath = path.join(CHROME_USER_DATA_DIR, 'Default', 'Cookies');
      
      if (fs.existsSync(cookiesPath)) {
        const stats = fs.statSync(cookiesPath);
        // File size > 30KB means cookies have been written
        if (stats.size > 30 * 1024) {
          loginSuccess = true;
          break;
        }
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n');
    if (loginSuccess) {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║              ✅ Login Successful!                          ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('\n✨ Your credentials have been saved.');
      console.log('📦 You can now use the app to scrape YouTube data automatically!\n');
      console.log('🎯 Next steps:');
      console.log('   • Go to YouTube Scraper page in the app');
      console.log('   • Click "Scrape All" to start scraping (no browser will open)\n');
      process.exit(0);
    } else {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║              ⏱️  Login Timeout!                             ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('\n❌ Login was not completed in 120 seconds.');
      console.log('📝 Please try again: npm run yt-login\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              ❌ Error During Login Setup                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n⚠️  ${error.message}\n`);
    logger.error('YouTube Studio login setup failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
