var margin = {top: 50, right: 50, bottom: 50, left: 50}
    , width = window.innerWidth - margin.left - margin.right 
    , height = window.innerHeight - margin.top - margin.bottom;

var d3 = d3 ? d3 : {};

d3.json('/dmarc.json').then((data) => {

    var parseDate = d3.timeParse("%Y-%m-%d");
    var dataset = Object.keys(data).sort().reduce((s,i) => { 
        s.push({x:parseDate(i)
            ,total:data[i].total
            ,spf:data[i].fail_spf
            ,dkim:data[i].fail_dkim
        }); 
        return s; 
    },[]);

    var xScale = d3.scaleTime()
        .domain(d3.extent(dataset.map(d=>d.x)))
        .range([0,width]);

    var yScale = d3.scaleLinear()
        .domain([0,d3.max(dataset.map(d=>d.total))])
        .range([height, 0]);

    var line = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.total));

    var svg = d3.select("body").append("svg")
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
    
    const barwidth = width / dataset.length / 2;
    svg.selectAll(".spf")
        .data(dataset)
        .enter().append("rect")
        .attr("class", "spf")
        .attr("x", d => xScale(d.x)-barwidth)
        .attr("y", d => yScale(d.spf))
        .attr("width", barwidth)
        .attr("height", d => height-yScale(d.spf));
    
    svg.selectAll(".dkim")
        .data(dataset)
        .enter().append("rect")
        .attr("class", "dkim")
        .attr("x", d => xScale(d.x))
        .attr("y", d => yScale(d.dkim))
        .attr("width", barwidth)
        .attr("height", d => height-yScale(d.dkim));

    svg.append("path")
        .datum(dataset)
        .attr("class", "line")
        .attr("d", line);

    svg.selectAll(".dot")
        .data(dataset)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.total))
        .attr("r", 5)
        .on("mouseover", (d,i,c) => d3.select(c[i]).attr("r",10))
        .on("mouseout", (d,i,c) => d3.select(c[i]).attr("r",5));
   
});
