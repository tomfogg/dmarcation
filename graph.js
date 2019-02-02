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

    let drawGraph = (dataset,showing,type,stattypes,series) => {

        const datef = d3.timeFormat('%Y-%m-%d');

        let xScale = null;
        if(typeof dataset[0].x != 'object') xScale = d3.scaleBand()
            .domain(dataset.map(d=>d.x))
            .rangeRound([0,width]);
        else {
            const e = d3.extent(dataset.map(d=>d.x));
            e[1] = (new Date(e[1])).setDate(e[1].getDate()+1);
            xScale = d3.scaleTime()
                .domain(e)
                .rangeRound([0,width]);
        }

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

        let showlabel = (i,show) => d3.selectAll(".label").classed("hidden",(d,j) => j==i ? show : true);

        showing.map((s,si)=>{
            let sgroup = svg.append("g")
                .classed(s,true);

            let barwidth = width/dataset.length/showing.length/1.5;
            sgroup.selectAll("."+s+"-bar")
                .data(dataset)
                .join("rect")
                .classed("bar", true)
                .classed(s+"-bar", true)
                .attr("x", d=>xScale(d.x))
                .attr("y", d=>yScale(d[s]))
                .attr("height", d=>yScale(0)-yScale(d[s]))
                .attr("width", barwidth)
                .attr("transform", "translate("+si*barwidth+")")
                .attr("fill",d3.schemeCategory10[series.indexOf(s)])
                .on("mouseover", (d,i) => showlabel(i,false))
                .on("mouseout", (d,i) => showlabel(i,true))
                .on("click", d => {
                    state.day = datef(d.x);
                    state.stattype = stattypes[0];
                    history.pushState({},"",state2url(state));
                    url2graph();
                });
        });

        series.map((s,si)=>{
            svg.append("text")
                .attr("x",width)
                .attr("dx","-10em")
                .attr("dy",si+"em")
                .attr("fill",d3.schemeCategory10[si])
                .text(s+" "+(showing.indexOf(s) < 0 ? " (show)" : " (hide)"))
                .on("click",(e,i,c)=>{
                    if(showing.length > 1 && showing.indexOf(s) >= 0) showing=showing.filter(d=>d!=s);
                    else showing.push(s);
                    state.showing = showing.join(',');
                    history.pushState({},"",state2url(state));
                    url2graph();
                });
        });
       
            stattypes.map((s,si)=>svg.append("text")
                .attr("x",width)
                .attr("dx","-10em")
                .attr("dy",series.length+1+si+"em")
                .attr("fill",d3.schemeCategory10[si])
                .text(s+" "+(state.stattype!=s ? " (show)" : " (showing)"))
                .on("click",(e,i,c)=>{
                    state.stattype=s;
                    d3.select(c[0]).text(s+" "+(state.stattype!=s ? " (show)" : " (showing)"));
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
                    delete state.stattype;
                    delete state.day;
                    history.pushState({},"",state2url(state));
                    url2graph();
                });

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
            .text(d=>typeof d.x == 'object' ? datef(d.x) : d.x);

        series.map((t,i)=>{
            label.append("text")
                .attr("dy", 2+i+'em')
                .attr("dx", '1em')
                .text(d=>t+": "+d3.format(".0s")(d[t]));
        });
    };
    
    let parseDate = d3.timeParse("%Y-%m-%d");
    let statt = (d,dd) => Object.keys(d).reduce((s,i,ii) => {
        s.push({...d[i], x: dd ? parseDate(i) : i});
        return s; 
    },[]);
    let url2graph = () => {
        let state = url2state(location.href.replace(location.origin,''));
        let dataset = [];
        let type = 'bar';
        if(state.day) dataset = statt(data.days[state.day][state.stattype],false);
        else if(state.stattype) dataset = statt(data[state.stattype],false);
        else {
            dataset = statt(data.days,true);
            type = 'bar';
            state.stattype = 'days';
        }

        let stattypes = Object.keys(data).filter(d=>d!='days');
        let series = Object.keys(dataset[0]).filter(d=>stattypes.concat('x').indexOf(d)<0);
        if(!('showing' in state)) state.showing = series.join(',');
        drawGraph(dataset,state.showing.split(/,/),type,stattypes,series);
    };

    url2graph();
    window.onpopstate = url2graph;
});
