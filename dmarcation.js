const parse = require('mailparser').simpleParser;
const fs = require('fs');
const readline = require('readline');
const zip = require('adm-zip');
const parseString = require('xml2js').parseString;
const zlib = require('zlib');
const Resolver = require('dns').Resolver;

const NUM_RESOLVERS = 10;
const MAX_RETRIES = 5;
const DO_LOOKUP = false;

const resolver = [];
for(let i=0;i<NUM_RESOLVERS;i++) {
    resolver[i] = new Resolver();
    resolver[i].setServers([
        '1.1.1.1',
        '8.8.8.8',
        '1.0.0.1',
        '8.8.4.4'
    ].sort(()=>Math.random()-0.5));
}

async function processLineByLine() {
    const fromstats = {};
    const tostats = {};
    const graphstats = {};
    const dnscache = {};
    const dnsretry = {};
    const fileStream = fs.createReadStream('/mailbox');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    let mail = '';
    let maxgap = 0;
    let readmailbox = false;

    const done = () => {
        process.stdout.write("\r"+Object.keys(dnscache)
            .filter(d=>typeof dnscache[d] === 'object').length+' DNS lookups left       '
            +Object.keys(dnscache).length+' total lookups');

        if(readmailbox && Object.keys(dnscache).length > 0 
            && Object.keys(dnscache).filter(d=>typeof dnscache[d] === 'object').length === 0) {
            const display = (stats) => {
                const o = Object.keys(stats).sort((a,b)=>stats[a].total-stats[b].total);
                o.slice(-20).reverse().map(i=>console.log(i,stats[i]));
            };
            console.log('==========');
            console.log('Top 20 addresses mails were sent from');
            display(fromstats);
            console.log('Top 20 addresses mails were sent to');
            display(tostats);
            console.log('stats by day');
            console.log(graphstats);
            
            console.log('listening on 8000');
            require('http').createServer(function (req, res) {
                console.log((new Date()).toISOString()+" "+req.method+": "+req.url);

                if(req.url.match(/^\/dmarc.json/)) {
                    res.setHeader("Content-Type", 'application/json');
                    res.writeHead(200);
                    res.end(JSON.stringify(graphstats));
                } else if(req.url.match(/^\/graph.js/)) {
                    res.setHeader("Content-Type", 'application/javascript');
                    res.writeHead(200);
                    res.end(fs.readFileSync('/codecopy/graph.js'));
                } else {
                    res.setHeader("Content-Type", 'text/html');
                    res.writeHead(200);
                    res.end(fs.readFileSync('graph.html'));
                }
            }).listen(8000);
        }
    };

    const doparse = (x,parsed) => {
        parseString(x, (e, r) => {
  //          if(parsed.headers.get('subject').match(/google.com/)) console.log(x.toString());
            if(e) {
                console.log(parsed.headers.get('subject'),'error parsing xml');
                return;
            }
            //                      console.log(r.feedback.report_metadata.length);
            //                        if(!r.feedback.report_metadata[0].org_name) console.log(r.feedback.report_metadata);
            //
            //
            const day = new Date(r.feedback.report_metadata[0].date_range[0].begin*1000).toISOString().slice(0,10);
            const begin = r.feedback.report_metadata[0].date_range[0].begin;
            const end = r.feedback.report_metadata[0].date_range[0].end;
            maxgap = Math.max(Math.round((end-begin)/60/60/24),maxgap);
//            console.log('datat from '+new Date(begin*1000)+' to '+new Date(end*1000), Math.round((end-begin)/60/60/24));
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

                    };

                    dostats(day,graphstats);
                    dostats(t,tostats);
                    if(source in dnscache) {
                        if(typeof dnscache[source] === 'object') dnscache[source].push(dostats);
                        else dostats(dnscache[source],fromstats);
                    } else {
                        dnscache[source] = [dostats];
                        const resolveresult = (e,h)=> {
                            if(e) { 
                                dnsretry[source] = source in dnsretry ? dnsretry[source]+1 : 1;
                                if(DO_LOOKUP && dnsretry[source] < MAX_RETRIES) {
                                    console.log('failed lookup of '+source+' retry '+dnsretry[source]);
                                    setTimeout(()=>resolver[Math.floor(Math.random()*NUM_RESOLVERS)]
                                        .reverse(source,resolveresult),1000*dnsretry[source]+Math.random()*5000);
                                    return;
                                }
                            }
                            const t = e?source:h.toString().match(/([^/.]+\.(com|co)\.\w+|[^/.]+.\w+)$/)[1];
                            dnscache[source].map(f=>f(t,fromstats));
                            dnscache[source] = t;
                            done();
                        };
                        if(DO_LOOKUP) resolver[Math.floor(Math.random()*NUM_RESOLVERS)].reverse(source,resolveresult);
                        else resolveresult(true,false);
                    }
                });
            });
        });
    };


    for await (const line of rl) {
        if(line.match(/^From /)) {
            let parsed = await parse(mail);
            if(parsed.attachments.length) {
                const a = parsed.attachments[0];
                if(a.contentType == 'application/zip') {
                    const z = new zip(a.content);
                    z.getEntries().map(f=>{
                        doparse(f.getData(),parsed);
                    });
                } else if(a.contentType && a.contentType.match(/gzip/)) {
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

processLineByLine();
