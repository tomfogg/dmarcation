let margin = {top: 50, right: 50, bottom: 100, left: 50}
    , width = window.innerWidth - margin.left - margin.right 
    , height = window.innerHeight - margin.top - margin.bottom;

const state2url = s => {
    let url = "/"+Object.keys(s)
        .filter(d=>['options'].indexOf(d)==-1 && s[d])
        .map(d=>d+"/"+s[d])
        .join('/');
    if('options' in s && Object.keys(s.options).length) {
        let opt = Object.keys(s.options)
            .filter(d=>typeof s.options[d] !== 'function' && s.options[d] && s.options[d] != undefined)
            .map(d=>d+"="+(s.options[d] instanceof Date ? +s.options[d] : s.options[d]))
            .join('&');
        if(opt !== '') url+=(url.match(/\/$/) ? "?" : "/?")+opt;
    }
    return url;
};

const url2state = (url) => {
    let s = url.split(/\//)
        .filter(a=>a.length)
        .map(d=>d.replace(/\?.*$/,''))
        .reduce((s,v,i,a)=>{if(i<a.length-1 && i % 2 == 0) s[v]=a[i+1]; return s;},{});
    s.options = url.substr(url.indexOf('?')+1)
        .split(/&/)
        .filter(d=>d.match(/.+=.*/))
        .reduce((i,d)=>{
            var k = d.split(/=/)[0];
            var v = d.split(/=/)[1];
            i[k] = v;
            return i;
        },{});
    if(Object.keys(s.options).length == 0) delete s.options;
    state = {};
    Object.assign(state,s);
    return s;
};

d3.json('/dmarc.json').then((data) => {

    let parseDate = d3.timeParse("%Y-%m-%d");
    let statt = d => Object.keys(d).reduce((s,i,ii) => {
        s.push({...d[i], x: i});
        return s; 
    },[]).sort((a,b)=>b.total-a.total).slice(0,20);
    let dataset = Object.keys(data).sort().reduce((s,i) => { 
        s.push({x:parseDate(i)
            ,total:data[i].total
            ,fail_spf:data[i].fail_spf
            ,fail_dkim:data[i].fail_dkim
            ,fromstats:statt(data[i].fromstats)
            ,tostats:statt(data[i].tostats)
        }); 
        return s; 
    },[]);

    let stattypes = ['fromstats','tostats'];
    let series = Object.keys(dataset[0]).filter(d=>stattypes.concat('x').indexOf(d)<0);
    let state = {
        showing: series.join(','),
    };

    let drawGraph = (dataset,showing,type='line') => {

        let xScale = d3.scaleTime()
            .domain(d3.extent(dataset.map(d=>d.x)))
            .rangeRound([0,width]);
        
        if(type=='bar') xScale = d3.scaleBand()
            .domain(dataset.map(d=>d.x))
            .rangeRound([0,width]);

        let yScale = d3.scaleLinear()
            .domain([0,d3.max(dataset.map(d=>d3.max(showing.map(s=>d[s]))))])
            .range([height, 0]);


        d3.select("svg").remove(); 
        let svg = d3.select("body").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(xScale))
            .selectAll("text")
            .attr("y", 0)
            .attr("x", 9)
            .attr("dy", ".35em")
            .attr("transform", "rotate(90)")
            .style("text-anchor", "start");


        svg.append("g")
            .attr("class", "y axis")
            .call(d3.axisLeft(yScale));

        let showlabel = (i,show) => {
            d3.selectAll(".label")
                .classed("hidden",(d,j) => j==i ? show : true);
            series.map(s=>d3.selectAll("."+s+"-dot")
                .attr("r", (d,j) => j==i && !show ? 15 : 10));
        };

        series.map((s,si)=>{
            let sgroup = svg.append("g")
                .classed(s,true)
                .classed("hidden", showing.indexOf(s) < 0);

            if(type == 'line') {
                sgroup.selectAll("."+s+"-dot")
                    .data(dataset)
                    .enter().append("circle")
                    .classed("dot", true)
                    .classed(s+"-dot", true)
                    .attr("cx", d => xScale(d.x))
                    .attr("cy", d => yScale(d[s]))
                    .attr("r", 10)
                    .attr("fill",d3.schemeCategory10[si])
                    .on("mouseover", (d,i) => showlabel(i,false))
                    .on("mouseout", (d,i) => showlabel(i,true))
                    .on("click", (d,i) => {
                        state.day = i;
                        state.daytype = stattypes[0];
                        history.pushState({},"",state2url(state));
                        url2graph();
                    });
                sgroup.append("path")
                    .datum(dataset)
                    .classed("line",true)
                    .classed(s+"-line",true)
                    .attr("stroke",d3.schemeCategory10[si])
                    .attr("d", d3.line()
                        .x(d => xScale(d.x))
                        .y(d => yScale(d[s])));
            } else {
                sgroup.selectAll("."+s+"-bar")
                    .data(dataset)
                    .join("rect")
                    .classed("bar", true)
                    .classed(s+"-bar", true)
                    .attr("x", d=>xScale(d.x))
                    .attr("y", d=>yScale(d[s]))
                    .attr("height", d=>yScale(0)-yScale(d[s]))
                    .attr("width", xScale.bandwidth()/series.length-1)
                    .attr("transform", "translate("+si*xScale.bandwidth()/series.length+")")
                    .attr("fill",d3.schemeCategory10[si]);
            }

            svg.append("text")
                .attr("x",width)
                .attr("dx","-10em")
                .attr("dy",si+"em")
                .attr("fill",d3.schemeCategory10[si])
                .text(s+" "+(showing.indexOf(s) < 0 ? " (show)" : " (hide)"))
                .on("click",(e,i,c)=>{
                    if(showing.length > 1 && showing.indexOf(s) >= 0) showing=showing.filter(d=>d!=s);
                    else showing.push(s);
                    sgroup.classed("hidden",showing.indexOf(s) < 0);
                    d3.select(c[0]).text(s+" "+(showing.indexOf(s) < 0 ? " (show)" : " (hide)"));
                    state.showing = showing.join(',');
                    history.pushState({},"",state2url(state));
                    url2graph();
                });
        });
       
        if(state.daytype) {
            stattypes.map((s,si)=>svg.append("text")
                .attr("x",width)
                .attr("dx","-10em")
                .attr("dy",series.length+1+si+"em")
                .attr("fill",d3.schemeCategory10[si])
                .text(s+" "+(state.daytype!=s ? " (show)" : " (showing)"))
                .on("click",(e,i,c)=>{
                    state.daytype=s;
                    d3.select(c[0]).text(s+" "+(state.daytype!=s ? " (show)" : " (showing)"));
                    history.pushState({},"",state2url(state));
                    url2graph();
                }));

            svg.append("text")
                .attr("x",width)
                .attr("dx","-10em")
                .attr("dy",stattypes.length+series.length+2+"em")
                .attr("fill",'black')
                .text('back')
                .on("click",()=>{
                    delete state.daytype;
                    delete state.day;
                    history.pushState({},"",state2url(state));
                    url2graph();
                });
        }

        let label = svg.selectAll(".label")
            .data(dataset)
            .enter().append("g")
            .attr("class", "label hidden")
            .attr("transform", d => "translate("+(10+xScale(d.x))+","+(yScale(d[showing[0]])-50)+")");

        label.append("rect")
            .attr("width", "8em")
            .attr("height", "5em");

        label.append("text")
            .attr("dy", '1em')
            .attr("dx", '1em')
            .text(d=>d3.timeFormat('%Y-%m-%d')(d.x));

        series.map((t,i)=>{
            label.append("text")
                .attr("dy", 2+i+'em')
                .attr("dx", '1em')
                .text(d=>t+": "+d3.format(".0s")(d[t]));
        });
    };

    let url2graph = () => {
        state = url2state(location.href.replace(location.origin,''));
        if(!('showing' in state)) {
            history.pushState({},"",state2url(state));
        }
        if(state.day) {
            drawGraph(dataset[state.day][state.daytype],state.showing.split(/,/),'bar');
        } else drawGraph(dataset,state.showing.split(/,/));
    };

    url2graph();
    window.onpopstate = url2graph;
});
