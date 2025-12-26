// ============================================================================
// Download Angel One Scrip Master File
// Usage: node downloadScripMaster.js
// ============================================================================

const https = require('https');
const fs = require('fs');
const path = require('path');

const SCRIP_MASTER_URL = 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';
const OUTPUT_FILE = path.join(__dirname, 'OpenAPIScripMaster.json');
const OUTPUT_TXT = path.join(__dirname, 'OpenAPIScripMaster.txt');

console.log('='.repeat(80));
console.log('DOWNLOADING ANGEL ONE SCRIP MASTER FILE');
console.log('='.repeat(80));
console.log(`\nURL: ${SCRIP_MASTER_URL}`);
console.log(`Output JSON: ${OUTPUT_FILE}`);
console.log(`Output TXT: ${OUTPUT_TXT}`);

console.log('\n⏳ Downloading... (this may take a minute)');

https.get(SCRIP_MASTER_URL, (response) => {
    if (response.statusCode !== 200) {
        console.error(`\n❌ Failed to download: HTTP ${response.statusCode}`);
        process.exit(1);
    }

    let data = '';
    let totalBytes = 0;

    response.on('data', (chunk) => {
        data += chunk;
        totalBytes += chunk.length;
        process.stdout.write(`\r   Downloaded: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
    });

    response.on('end', () => {
        console.log('\n\n✅ Download complete!');
        
        try {
            // Parse JSON
            console.log('\n📊 Parsing JSON...');
            const jsonData = JSON.parse(data);
            
            // Save as JSON
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(jsonData, null, 2), 'utf8');
            console.log(`✅ Saved JSON: ${OUTPUT_FILE}`);
            
            // Save as formatted TXT
            console.log('\n📝 Creating formatted TXT file...');
            let txtContent = [];
            
            txtContent.push('='.repeat(120));
            txtContent.push('ANGEL ONE SCRIP MASTER FILE');
            txtContent.push('='.repeat(120));
            txtContent.push(`Downloaded: ${new Date().toLocaleString()}`);
            txtContent.push(`Total Instruments: ${jsonData.length}`);
            txtContent.push('='.repeat(120));
            txtContent.push('');
            
            // Group by exchange
            const byExchange = {};
            jsonData.forEach(item => {
                const exch = item.exch_seg || item.exchange || 'UNKNOWN';
                if (!byExchange[exch]) byExchange[exch] = [];
                byExchange[exch].push(item);
            });
            
            // Summary
            txtContent.push('SUMMARY BY EXCHANGE:');
            txtContent.push('-'.repeat(120));
            Object.entries(byExchange).forEach(([exchange, items]) => {
                txtContent.push(`${exchange.padEnd(15)} ${items.length.toString().padStart(10)} instruments`);
            });
            txtContent.push('');
            
            // Detailed listing
            txtContent.push('='.repeat(120));
            txtContent.push('DETAILED INSTRUMENT LIST');
            txtContent.push('='.repeat(120));
            txtContent.push('');
            
            Object.entries(byExchange).forEach(([exchange, items]) => {
                txtContent.push('');
                txtContent.push(`${'='.repeat(120)}`);
                txtContent.push(`EXCHANGE: ${exchange} (${items.length} instruments)`);
                txtContent.push(`${'='.repeat(120)}`);
                txtContent.push('');
                
                // Show first 100 items per exchange
                const displayItems = items.slice(0, 100);
                
                displayItems.forEach((item, idx) => {
                    txtContent.push(`${idx + 1}. ${item.symbol || item.tradingsymbol || 'N/A'}`);
                    txtContent.push(`   Token: ${item.token || 'N/A'}`);
                    txtContent.push(`   Name: ${item.name || 'N/A'}`);
                    txtContent.push(`   Instrument: ${item.instrumenttype || item.instrument_type || 'N/A'}`);
                    txtContent.push(`   Strike: ${item.strike || 'N/A'}`);
                    txtContent.push(`   Expiry: ${item.expiry || 'N/A'}`);
                    txtContent.push(`   Lot Size: ${item.lotsize || item.lot_size || 'N/A'}`);
                    txtContent.push('');
                });
                
                if (items.length > 100) {
                    txtContent.push(`... and ${items.length - 100} more instruments in ${exchange}`);
                    txtContent.push('');
                }
            });
            
            fs.writeFileSync(OUTPUT_TXT, txtContent.join('\n'), 'utf8');
            console.log(`✅ Saved TXT: ${OUTPUT_TXT}`);
            
            // Show statistics
            console.log('\n' + '='.repeat(80));
            console.log('STATISTICS');
            console.log('='.repeat(80));
            console.log(`Total Instruments: ${jsonData.length}`);
            console.log(`\nBy Exchange:`);
            Object.entries(byExchange).forEach(([exchange, items]) => {
                console.log(`  ${exchange.padEnd(10)} ${items.length.toString().padStart(8)} instruments`);
            });
            
            // Sample data
            console.log('\n' + '='.repeat(80));
            console.log('SAMPLE DATA (First 3 items):');
            console.log('='.repeat(80));
            jsonData.slice(0, 3).forEach((item, idx) => {
                console.log(`\n${idx + 1}. ${JSON.stringify(item, null, 2)}`);
            });
            
            console.log('\n' + '='.repeat(80));
            console.log('✅ DOWNLOAD COMPLETE!');
            console.log('='.repeat(80));
            console.log(`\n📄 JSON file: ${path.basename(OUTPUT_FILE)}`);
            console.log(`📄 TXT file: ${path.basename(OUTPUT_TXT)}`);
            console.log('='.repeat(80));
            
        } catch (error) {
            console.error('\n❌ Error processing data:', error.message);
            process.exit(1);
        }
    });

}).on('error', (error) => {
    console.error('\n❌ Download error:', error.message);
    process.exit(1);
});