const parse = require('mailparser').simpleParser;
const fs = require('fs');
const readline = require('readline');
const zip = require('adm-zip');
const parseString = require('xml2js').parseString;
const zlib = require('zlib');
const { Resolver, setServers} = require('dns');
setServers([
    '1.1.1.1',
    '8.8.8.8',
    '1.0.0.1',
    '8.8.4.4'
]);
const resolver = new Resolver();

async function processLineByLine() {
    const fromstats = {};
    const tostats = {};
    const dnscache = {};
    const fileStream = fs.createReadStream('/mailbox');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    let mail = '';
    let lookup = 0;

    const done = () => {
        process.stdout.write("\r"+lookup+' DNS lookups left       '+Object.keys(dnscache).length+' cached DNS');
        if(lookup === 0) {
            const display = (stats) => {
                const o = Object.keys(stats).sort((a,b)=>stats[a].total-stats[b].total);
                o.slice(-20).map(i=>console.log(i,stats[i]));
            };
            console.log('Top 20 addresses mails were sent from');
            display(fromstats);
            console.log('Top 20 addresses mails were sent to');
            display(tostats);
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

                    dostats(t,tostats);
                    if(source in dnscache) dostats(dnscache[source] === false?source:dnscache[source],fromstats);
                    else {
                        lookup++;
                        resolver.reverse(source,(e,h)=>{ 
                            lookup--; 
                            let t = e?source:h.toString().match(/([^/.]+\.(com|co)\.\w+|[^/.]+.\w+)$/)[1];
                            dnscache[source] = t;
                            dostats(t,fromstats);
                        });
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
                } else console.log(parsed.headers.get('subject'),'bad contentType',a.contentType);
            } else console.log(parsed.headers.get('subject'),'no attachment');
            mail = '';
        }
        mail += line+"\n";
    }

}

processLineByLine();
