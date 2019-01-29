let margin = {top: 50, right: 50, bottom: 50, left: 50}
    , width = window.innerWidth - margin.left - margin.right 
    , height = window.innerHeight - margin.top - margin.bottom;


d3.json('/dmarc.json').then((data) => {

    let parseDate = d3.timeParse("%Y-%m-%d");
    let dataset = Object.keys(data).sort().reduce((s,i) => { 
        s.push({x:parseDate(i)
            ,total:data[i].total
            ,fail_spf:data[i].fail_spf
            ,fail_dkim:data[i].fail_dkim
        }); 
        return s; 
    },[]);

    let series = Object.keys(dataset[0]).filter(d=>d!='x');
    let showing = series.reduce((s,d)=>{s[d]=true; return s;},{});

    let drawGraph = () => {

        let ex = d3.extent(dataset.map(d=>d.x));
        ex[0] = ex[0]-24*60*60*1000;
        let xScale = d3.scaleTime()
            .domain(ex)
            .range([0,width]);

        let yScale = d3.scaleLinear()
            .domain([0,d3.max(dataset.map(d=>d3.max(Object.keys(showing).map(s=>d[s]))))])
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
            .call(d3.axisBottom(xScale));

        svg.append("g")
            .attr("class", "y axis")
            .call(d3.axisLeft(yScale));

        let showlabel = (i,show) => {
            d3.selectAll(".label")
                .classed("hidden",(d,j) => j==i ? show : true);
            series.map(s=>d3.selectAll("."+s+"-dot")
                .attr("r", (d,j) => j==i && !show ? 10 : 5));
        };

        series.map((s,si)=>{
            let sgroup = svg.append("g")
                .classed(s,true)
                .classed("hidden", !(s in showing));
            sgroup.selectAll("."+s+"-dot")
                .data(dataset)
                .enter().append("circle")
                .classed("dot", true)
                .classed(s+"-dot", true)
                .attr("cx", d => xScale(d.x))
                .attr("cy", d => yScale(d[s]))
                .attr("r", 5)
                .attr("fill",d3.schemeCategory10[si])
                .on("mouseover", (d,i) => showlabel(i,false))
                .on("mouseout", (d,i) => showlabel(i,true));
            sgroup.append("path")
                .datum(dataset)
                .classed("line",true)
                .classed(s+"-line",true)
                .attr("stroke",d3.schemeCategory10[si])
                .attr("d", d3.line()
                    .x(d => xScale(d.x))
                    .y(d => yScale(d[s])));
            svg.append("text")
                .attr("dy",si+"em")
                .attr("fill",d3.schemeCategory10[si])
                .text(s+" "+(s in showing ? " (hide)" : " (show)"))
                .on("click",(e,i,c)=>{
                    if(s in showing && Object.keys(showing).length > 1) delete showing[s];
                    else showing[s] = true;
                    sgroup.classed("hidden",!(s in showing));
                    d3.select(c[0]).text(s+" "+(s in showing ? " (hide)" : " (show)"));
                    drawGraph();
                });
        });

        let label = svg.selectAll(".label")
            .data(dataset)
            .enter().append("g")
            .attr("class", "label hidden")
            .attr("transform", d => "translate("+xScale(d.x)+","+(yScale(d[Object.keys(showing)[0]])-50)+")");

        label.append("rect")
            .attr("width", "8em")
            .attr("height", "4em");

        ['total','fail_spf','fail_dkim'].map((t,i)=>{
            label.append("text")
                .attr("dy", 1+i+'em')
                .attr("dx", '1em')
                .text(d=>t+": "+d3.format(".0s")(d[t]));
        });
    };

    drawGraph();
   
});
