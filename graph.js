let margin = {top: 50, right: 50, bottom: 100, left: 50}
    , width = window.innerWidth - margin.left - margin.right 
    , height = window.innerHeight - margin.top - margin.bottom;


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

    let series = Object.keys(dataset[0]).filter(d=>['x','fromstats','tostats'].indexOf(d)<0);
    let showing = series.reduce((s,d)=>{s[d]=true; return s;},{});

    let drawGraph = (dataset, type='line') => {

        console.log(dataset.slice(0,5),type);

        let xScale = d3.scaleTime()
            .domain(d3.extent(dataset.map(d=>d.x)))
            .rangeRound([0,width]);
        
        if(type=='bar') xScale = d3.scaleBand()
            .domain(dataset.map(d=>d.x))
            .rangeRound([0,width]);

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
                .classed("hidden", !(s in showing));

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
                        showing = series.reduce((s,d)=>{s[d]=true; return s;},{});
                        drawGraph(dataset[i].fromstats,'bar')
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
                .text(s+" "+(s in showing ? " (hide)" : " (show)"))
                .on("click",(e,i,c)=>{
                    if(s in showing && Object.keys(showing).length > 1) delete showing[s];
                    else showing[s] = true;
                    sgroup.classed("hidden",!(s in showing));
                    d3.select(c[0]).text(s+" "+(s in showing ? " (hide)" : " (show)"));
                    drawGraph(dataset,type);
                });
        });

        let label = svg.selectAll(".label")
            .data(dataset)
            .enter().append("g")
            .attr("class", "label hidden")
            .attr("transform", d => "translate("+(10+xScale(d.x))+","+(yScale(d[Object.keys(showing)[0]])-50)+")");

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

    drawGraph(dataset);
   
});
