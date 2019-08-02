const parse = require('mailparser').simpleParser;
const fs = require('fs');
const readline = require('readline');
const zip = require('adm-zip');
const parseString = require('xml2js').parseString;
const zlib = require('zlib');
const Resolver = require('dns').Resolver;

const MAX_RETRIES = 5;
const DO_LOOKUP = true;

const resolver = ['1.1.1.1',
    '8.8.8.8',
    '1.0.0.1',
    '8.8.4.4',
    '9.9.9.9',
    '149.112.122.112',
    '208.67.222.222', 
    '208.67.220.220']
    .map(d=>{
        const r = new Resolver();
        r.setServers([d]);
        return {
            active: false, 
            resolve: r};
    });

const cache = {};
const retry = {};

const report = () => process.stdout.write("\r"+
    'LOOKUPS '+Object.keys(cache).length+
    ' DONE '+Object.keys(cache).reduce((s,d)=>s+(cache[d] !== false ? 1 : 0),0)+
    ' RETRIES '+Object.keys(retry).reduce((s,d)=>s+retry[d],0)+
    ' FAILS '+  Object.keys(retry).reduce((s,d)=>s+(retry[d]>MAX_RETRIES?1:0),0)+
    '        ');

const lookup = (ip,result) => {
    if(!(ip in cache)) cache[ip] = false;
    if(!DO_LOOKUP) return result(ip);
    if(cache[ip] !== false) return result(cache[ip]);
    const ready = resolver.reduce((s,d,i)=>d.active?s:i,-1);
    if(ready < 0) {
        setTimeout(()=>lookup(ip,result),1000*(ip in retry ? retry[ip] : 1)+Math.random()*5000);
    } else {
        resolver[ready].active = true;
        const t = setTimeout(()=>getresult(true,null),5000);
        const getresult = (err,host)=>{
            clearTimeout(t);
            resolver[ready].active = false;
            if(err) {
                if(retry[ip] > MAX_RETRIES) {
                    cache[ip] = ip;
                    report();
                    return result(ip);
                }
                retry[ip] = retry[ip] ? retry[ip]+1 : 1;
                lookup(ip,result);
            } else {
                cache[ip] = host[0];
                report();
                result(host[0]);
            }
        };
        resolver[ready].resolve.reverse(ip,getresult);
    }
};

const donelookup = () => Object.keys(cache).reduce((s,d)=>s+(cache[d] === false ? 1 : 0),0) == 0;

async function processLineByLine(mailbox) {
    console.log('reading '+mailbox);
    const fromstats = {};
    const tostats = {};
    const graphstats = {};
    const fileStream = fs.createReadStream(mailbox);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    let mail = '';
    let maxgap = 0;
    let readmailbox = false;
    let fin = false;

    const done = () => {
        if(readmailbox && donelookup() && !fin) {
            fin = true;
            const display = (stats) => {
                const o = Object.keys(stats).sort((a,b)=>stats[a].total-stats[b].total);
                o.slice(-20).reverse().map(i=>console.log(i,stats[i]));
            };
            console.log('==========');
            console.log('Top 20 addresses mails were sent from');
            display(fromstats);
            console.log('Top 20 addresses mails were sent to');
            display(tostats);
//            console.log('stats by day');
//            console.log(graphstats);

            const clip = stats=>Object.keys(stats)
                .sort((a,b)=>stats[a].total-stats[b].total)
                .slice(-20).reduce((s,d)=>{s[d] = stats[d]; return s;},{});
            
            console.log('listening on 8000');
            require('http').createServer(function (req, res) {
                console.log((new Date()).toISOString()+" "+req.method+": "+req.url);

                if(req.url.match(/^\/dmarc.json/)) {
                    res.setHeader("Content-Type", 'application/json');
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        days: Object.keys(graphstats).reduce((s,d)=>{
                            s[d]={...graphstats[d], 
                                fromstats: clip(graphstats[d].fromstats), 
                                tostats: clip(graphstats[d].tostats)};
                            return s;
                        },{}), 
                        fromstats: clip(fromstats), 
                        tostats: clip(tostats)}));
                } else if(req.url.match(/^\/graph.js/)) {
                    res.setHeader("Content-Type", 'application/javascript');
                    res.writeHead(200);
                    res.end(fs.readFileSync('/code/graph.js'));
                } else {
                    res.setHeader("Content-Type", 'text/html');
                    res.writeHead(200);
                    res.end(fs.readFileSync('/code/graph.html'));
                }
            }).listen(8000);
        }
    };

    const doparse = (x,parsed) => {
        parseString(x, (e, r) => {
            if(e) {
                console.log(parsed.headers.get('subject'),'error parsing xml');
                return;
            }
            const day = new Date(r.feedback.report_metadata[0].date_range[0].begin*1000).toISOString().slice(0,10);
            const begin = r.feedback.report_metadata[0].date_range[0].begin;
            const end = r.feedback.report_metadata[0].date_range[0].end;
            maxgap = Math.max(Math.round((end-begin)/60/60/24),maxgap);
            const t = r.feedback.report_metadata[0].org_name.join(',');
            r.feedback.record.map(d=>{
                d.row.map(r=>{
                    const source = r.source_ip.toString();
                    const dostats = (t,stats)=>{
                        if(!stats[t]) stats[t] = { total: 0, fail_spf: 0, fail_dkim: 0 };
                        const c = parseInt(r.count);
                        stats[t].total += c;
                        const p = r.policy_evaluated[0];
                        if(p.spf[0] == 'fail') stats[t].fail_spf += c;
                        if(p.dkim[0] == 'fail') stats[t].fail_dkim += c;
                        done();
                    };
                    if(!graphstats[day]) {
                        graphstats[day] = { total: 0, fail_spf: 0, fail_dkim: 0};
                        graphstats[day].tostats = {};
                        graphstats[day].fromstats = {};
                    }
                    dostats(day,graphstats);
                    dostats(t,tostats);
                    dostats(t,graphstats[day].tostats);
                    lookup(source,h=>{
                        const t = source==h?source:h.toString().match(/([^/.]+\.(com|co)\.\w+|[^/.]+.\w+)$/)[1];
                        dostats(t,fromstats);
                        dostats(t,graphstats[day].fromstats);
                    });
                });
            });
        });
    };


    for await (const line of rl) {
        if(line.match(/^From /)) {
            let parsed = await parse(mail);
            if(parsed.attachments.length) {
                const a = parsed.attachments[0];
                if(a.contentType == 'application/zip' || a.contentType == 'application/x-zip-compressed' || a.filename.match(/\.zip$/)) {
                    const z = new zip(a.content);
                    z.getEntries().map(f=>{
                        doparse(f.getData(),parsed);
                    });
                } else if((a.contentType && a.contentType.match(/gzip/)) || a.filename.match(/\.gz$/)) {
                    const xml = zlib.unzipSync(a.content);
                    doparse(xml,parsed);
                } else console.log('\n',parsed.headers.get('subject'),'bad contentType',a.contentType);
            } else console.log('\n',parsed.headers.get('subject'),'no attachment');
            mail = '';
        }
        mail += line+"\n";
    }

    readmailbox = true;
    done();
}

if(process.argv.length < 3) {
    console.log('usage npm start -- mailboxfile')
    return;
} else processLineByLine(process.argv[2]);
